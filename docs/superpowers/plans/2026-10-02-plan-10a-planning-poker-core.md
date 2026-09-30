# Plan 10a — Planning poker core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each team gets realtime planning-poker games: the facilitator lists tasks, picks one, everyone (members and guests by link) plays a hidden card, the facilitator reveals all cards at once, sees the average or distribution, re-votes if needed and records the final estimate; every round and vote is kept and browsable per task and on a team estimation history page — without any other player's card value ever reaching a browser before reveal.

**Architecture:** Five new tables (`poker_games`, `poker_players`, `poker_tasks`, `poker_rounds`, `poker_votes`) with every column of the spec, including the scope-addition columns Plan 10b uses. Players mirror retro participants (own table, shared `HasGuestIdentity` trait, scoped `GuestCookie`). All rules live in `App\Actions\Poker\PokerGuard` and single-purpose actions (`CreatePokerGame`, `AddPokerTask`, `SelectPokerTask`, `StartPokerRound`, `PlayPokerCard`, `RevealPokerRound`, `SetPokerEstimate`) called by thin controllers under `app/Http/Controllers/Poker/`, each mutating inside `DB::transaction` with `lockForUpdate` on the game (votes also on the round). Card values are serialized only by `PresentPokerRound` (used by `BuildPokerSnapshot`, the reveal/re-vote responses, the round history and the estimates page), so redaction lives in one place. Realtime uses `presence-poker.{gameId}` with `PokerBroadcastEvent` subclasses that never carry a value; reveal and selection travel as `round.changed` → snapshot refetch. The frontend is a new `resources/js/components/poker/` tree driven by `usePokerGame` (snapshot + reducer + buffered refetch, modelled on `useRetroBoard`).

**Tech Stack:** Laravel 13 (PHP 8.4), PostgreSQL, Pest, Reverb, `league/commonmark` via `Str::markdown`, React 19, Inertia v3, `@laravel/echo-react`, Wayfinder, Tailwind 4, lucide, Radix dialog/select/checkbox/dropdown/tooltip, `@dnd-kit/core` + `@dnd-kit/sortable` (all already installed).

**Spec:** `docs/superpowers/specs/2026-09-29-planning-poker-design.md` — §1, §2, §3 (Access, Facilitator, Tasks, Voting flow, Settings), §4 (all endpoints and events except those listed for Plan 10b), §5 (main invariant), §6, §7 (team page, game page, estimation history, join page, i18n), §8, §9 and §10 criteria 1–13. Plan 10b (`docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md`) delivers §3a–§3d, the "Live cursors and flying reactions" part of §4, the second invariant of §5 and criteria 14–19. Parent: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md`.

## Global Constraints

- Work on branch `feat/plan-10-planning-poker`, created from the current HEAD of `feat/plan-9-action-items-v2` (Plans 8a–9b implemented, unmerged). Plan 10b continues on the same branch.
- Commands through Sail: `vendor/bin/sail artisan …`, `vendor/bin/sail bin pint --dirty --format agent`, `vendor/bin/sail bin phpstan analyse --no-progress` (level 7, 0 errors). npm on the host.
- Tests run on PostgreSQL (the Sail `testing` database). Every table uses a UUID primary key (`tests/Feature/UuidPrimaryKeysTest.php` must stay green).
- Migration filenames use the prefix `2026_10_03_1000xx`; only `up()` methods.
- No new Composer or npm dependency. Markdown via `Str::markdown` (league/commonmark, already installed); drag-and-drop via `@dnd-kit/sortable`.
- **Request fields are snake_case**, like every existing endpoint (`guest_access_enabled`, `user_id`, `task_ids`, `task_id`, `custom_cards`, `include_unknown`, `include_coffee`, `anonymous_votes`, `auto_reveal`); the spec's camelCase body names map one-to-one. Response and broadcast payloads are camelCase exactly as spec §4/§6.
- Every mutation: resolve the player (middleware) → cheap guards on the route-bound game → `DB::transaction` with `PokerGame::query()->whereKey(...)->lockForUpdate()->firstOrFail()` (votes also lock the round row) → the same guards again on the locked rows → persist → broadcast with `->sendToOthers()` (after commit, `toOthers()`, report-don't-throw via `App\Events\Concerns\SendsToOthers`). Guard order: game ended (403) → role (403) → state rules (422).
- Card values leave the server only through `App\Actions\Poker\PresentPokerRound`. No broadcast payload ever contains a card value; no log line contains one.
- Guests never receive team or workspace data: `guestUrl`, `links.team` and `me.transferCandidates` are `null`/`[]` for guests; guests cannot reach `teams.*` pages or the estimates page (the `w/{workspace}` group already requires `auth`).
- Every user-facing string via `t()` / `__()` with real translations in `lang/{en,fr,es,de}.json` (German "du", French "vous", Spanish "tú"), appended at the end of each file, keeping every existing value. Each task lists its own rows; add only keys that are missing at execution time. Card labels (`XS`, `?`, `☕`, numbers) are never translated. `tests/Feature/TranslationKeysTest.php` stays green.
- Wayfinder: run `vendor/bin/sail artisan wayfinder:generate --with-form` after every route change. `resources/js/actions` and `resources/js/routes` are gitignored — never stage them. Frontend imports use the generated controllers (`@/actions/App/Http/Controllers/Poker/…`), never hard-coded URLs.
- Frontend checks: `npm run types:check && npm run check` (known pre-existing failures only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`). Format only touched files with `npx vp check --fix <paths>`.
- React: function components, `type Props`, no default exports except pages, Tailwind, lucide icons, `useGame()` for game state, `retroRequest()` from `@/lib/retro/api` for JSON calls (it adds `X-Socket-ID`; it is generic despite its name), `usePage().props.locale` for `Intl` formatting.
- PHP: constructor promotion, typed everything, array-shape docblocks on presenter return values, early returns, curly braces, no comments restating code, class constants in PascalCase. Test helper functions are global in Pest: every new helper name below is unique in `tests/`.
- Commit messages: Conventional Commits, ending with exactly:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS`

## Spec amendments made with this plan

Plan writing found five gaps in spec §6; the spec was updated before this plan (see its §6 "Snapshot"):

- the snapshot carries `links: {team: string|null}` (null for guests) so the "game deleted" state and the header back arrow can link to the team, as the retro snapshot does;
- the snapshot carries `serverTime` (UTC, `Y-m-d\TH:i:s.v\Z`) so countdowns (Plan 10b) use the server clock, as the retro snapshot does;
- `game.hasVotes` so the settings dialog can disable the deck choice once votes exist (§3 Settings);
- `me.userId` (null for guests) so "Take control" can name the viewer in `PUT facilitator`;
- `me.transferCandidates: [{userId, name}]` lists who the facilitator can hand over to (team members and workspace Owners/Admins, minus the viewer), empty for everyone else, as the retro snapshot does.

## Review Focus

1. **Reveal, re-vote or estimate on a task without a round, or on a task that is not current** (stale client after the facilitator switched tasks) → 422 with a translated message, never a 500 from a null `latestRound`. Pinned in Task 9 ("refuses reveal, re-vote and estimate on tasks without a round or not current").
2. **Reordering with a stale list** (a task was added or deleted since the client loaded) → 422 "The list of tasks is out of date." and nothing is reordered; duplicates or foreign ids → 422. Pinned in Task 7 ("refuses stale or foreign task orders").
3. **Custom deck edge shapes** — cards that collide after trimming (`" 3"`, `"3"`), a 9-character multibyte card, only special cards (`?`, `☕`), 21 cards, or the checkboxes appending `?` when the creator already typed it → 422 for the invalid ones, no duplicate `?` for the last. Pinned in Task 6 ("validates custom decks").
4. **The current task is deleted while a round is open** → every client drops the current task (reducer), a vote sent afterwards for the old round gets 404, and the snapshot has `current: null`. Pinned in Task 7 ("clears the current task when it is deleted") and Task 8 ("answers 404 for a round of a deleted task").
5. **Access revoked mid-game** — a member removed from the team, or a guest after the link was regenerated or guest access disabled, gets 403/401 on the next request and presence auth refused; a retro guest cookie never opens a poker game and vice versa. Pinned in Task 5 ("revokes removed members and signed-out guests", "keeps retro and poker guest cookies apart").

## File map

| Area | Files |
|---|---|
| Shared identity | `app/Concerns/HasGuestIdentity.php`; `app/Models/Participant.php`; `app/Actions/Retros/GuestCookie.php`; callers `app/Actions/Retros/ResolveParticipant.php`, `app/Http/Middleware/ResolveRetroParticipant.php`, `app/Http/Controllers/RetroJoinsController.php`, `tests/Pest.php`, `tests/Feature/Retros/GuestJoinTest.php` |
| Schema & models | `database/migrations/2026_10_03_100000_create_poker_tables.php`; `app/Enums/{PokerDeck,PokerRevealReason}.php`; `app/Models/{PokerGame,PokerPlayer,PokerTask,PokerRound,PokerVote,Team}.php`; `database/factories/{PokerGameFactory,PokerPlayerFactory,PokerTaskFactory,PokerRoundFactory,PokerVoteFactory}.php` |
| Pure logic | `app/Actions/Poker/{PokerResult,RenderTaskMarkdown}.php` |
| Access | `app/Actions/Poker/{ResolvePlayer,PokerGuard}.php`; `app/Http/Middleware/ResolvePokerPlayer.php`; `app/Http/Controllers/PokerJoinsController.php`; `app/Http/Controllers/BroadcastAuthorizationsController.php`; `app/Policies/TeamPolicy.php` |
| Game creation & team page | `app/Actions/Poker/{NewPokerGame,PokerDeckRules,CreatePokerGame,PresentPokerGameSummary}.php`; `app/Http/Controllers/{TeamPokerGamesController,TeamsController}.php` |
| Presenting & realtime | `app/Actions/Poker/{PresentPokerRound,PresentPokerTask,BuildPokerSnapshot}.php`; `app/Events/Poker/{PokerBroadcastEvent,PokerTaskSaved,PokerTaskDeleted,PokerTasksReordered,PokerVoteChanged,PokerRoundChanged,PokerGameChanged,PokerGameDeleted,PokerTaskEstimated}.php`; `app/Http/Controllers/Poker/{PokerGamesController,PokerSnapshotsController}.php` |
| Game mutations | `app/Actions/Poker/{AddPokerTask,SelectPokerTask,StartPokerRound,PlayPokerCard,RevealPokerRound,SetPokerEstimate}.php`; `app/Http/Controllers/Poker/{PokerTasksController,PokerTaskOrdersController,PokerCurrentTasksController,PokerVotesController,PokerRevealsController,PokerRoundsController,PokerTaskEstimatesController,PokerSettingsController,PokerStatusesController,PokerGuestTokensController,PokerFacilitatorsController}.php`; `routes/web.php` |
| History page | `app/Http/Controllers/TeamEstimatesController.php` |
| Frontend core | `resources/js/lib/poker/{types,game-reducer,format}.ts`; `resources/js/hooks/{use-poker-channel,use-poker-game}.ts`; `resources/js/components/poker/game-context.tsx`; `resources/js/app.tsx` |
| Frontend game UI | `resources/js/pages/poker/{show,join,estimates}.tsx`; `resources/js/components/poker/{game,game-header,game-menu,game-gone,take-control-button,tasks-pane,task-form-dialog,task-detail,round-history,players-grid,poker-card,hand,facilitator-toolbar,result-panel,game-settings-dialog,deck-fields,game-guest-link-dialog,transfer-dialog,delete-game-dialog}.tsx` |
| Frontend team UI | `resources/js/components/teams/{poker-games-section,new-poker-game-dialog}.tsx`; `resources/js/pages/teams/show.tsx`; `resources/js/types/poker.ts`; `resources/js/types/index.ts` |
| Tests | `tests/Pest.php`; `tests/Unit/Poker/{PokerDeckTest,PokerResultTest}.php`; `tests/Feature/Poker/{GuestIdentityTest,PokerModelTest,MarkdownTest,PokerAccessTest,PokerJoinTest,PokerBroadcastAuthorizationTest,CreatePokerGameTest,TeamPokerSectionTest,PokerSnapshotTest,PokerTasksTest,PokerVotingTest,PokerRevealTest,PokerEstimateTest,PokerRoundHistoryTest,PokerSettingsTest,PokerFacilitationTest,PokerRedactionTest,PokerEstimatesPageTest}.php` |
| Translations | `lang/{en,fr,es,de}.json` (rows inside each task) |

## Contract for Plan 10b

Plan 10b (spectators, timer and auto-reveal, anonymous rounds, saved decks, cursors and reactions) builds on exactly these products; renaming any of them breaks 10b:

- Columns created in Task 2 and not used by this plan's code beyond defaults and reads: `poker_games.{deck_name, auto_reveal, anonymous_votes, cursors_enabled, reactions_enabled}`, `poker_players.is_spectator`, `poker_rounds.{anonymous, timer_ends_at, reveal_reason}`. Casts and fillables for all of them exist on the models.
- `App\Enums\PokerDeck` (`cards()`, `label()`, `static numericValue()`, `static isSpecial()`, `static isNumericDeck()`, `static options()`, constants `UnknownCard`, `CoffeeCard`), `App\Enums\PokerRevealReason` (`Manual`, `EveryoneVoted`, `Timer`).
- `PokerGame::{isEnded(), isFacilitator(), isNumeric(), deckLabel(), hasVotes(), latestRoundOfCurrentTask()}`, relations `team`, `players`, `tasks`, `rounds`, `facilitator`, `currentTask`; `PokerTask::latestRound()`; `PokerRound::isRevealed()`; `PokerPlayer::current(Request)`.
- `PokerGuard::{facilitator, notEnded, canEditTasks, canVote, openRound, canDelete}` (`canVote` already refuses spectators with 403 "Spectators can't vote.").
- `NewPokerGame` (readonly DTO with `title, deck, cards, deckName, anonymousVotes, autoReveal`), `PokerDeckRules::{rules(), cards()}`, `CreatePokerGame::handle(Team, User, NewPokerGame): PokerGame`.
- `StartPokerRound::handle(PokerGame $locked, PokerTask $task): PokerRound` (copies `anonymous_votes` into `poker_rounds.anonymous` — 10b relies on this), `SelectPokerTask::handle(PokerGame $locked, ?PokerTask $task): void`, `PlayPokerCard::handle(PokerGame $game, PokerRound $round, PokerPlayer $player, ?string $value): array` (`{roundId, myVote, votesCount, version, revealed}`; `revealed` is always `false` in this plan), `RevealPokerRound::handle(PokerGame $locked, PokerRound $lockedRound, PokerRevealReason $reason): void`, `SetPokerEstimate::handle(PokerGame $locked, PokerTask $task, ?string $value): PokerTask`.
- `PresentPokerRound::handle(PokerRound $round, PokerGame $game, ?string $viewerPlayerId, bool $listUnrevealedVoters = true): array` (10b adds the anonymous redaction inside it), `PresentPokerTask::handle(PokerTask $task): array`, `BuildPokerSnapshot::handle(PokerGame $game, PokerPlayer $viewer): array` (already emits `game.{autoReveal, anonymousVotes, cursorsEnabled, reactionsEnabled}`, `me.{isSpectator, canVote}`, `players[].isSpectator`, `round.{anonymous, timerEndsAt, revealReason}`).
- Events `PokerBroadcastEvent` (presence channel `poker.{gameId}`), `PokerVoteChanged`, `PokerRoundChanged`, `PokerGameChanged`, `PokerTaskEstimated`.
- Controllers `Poker\PokerSettingsController::update` (validation array extended by 10b), `Poker\PokerVotesController::update` (10b calls the auto-reveal check after the action), `PokerJoinsController::store` (10b adds `spectator`), `TeamPokerGamesController::store` (10b adds `saved_deck_id`, `save_deck_as`), `TeamsController::show` (10b adds `pokerDecks`).
- Frontend: types in `resources/js/lib/poker/types.ts`; reducer actions of `game-reducer.ts`; `usePokerChannel` returns `{online, connected, reconnecting, presence}` with `presence: WhisperChannel | null`; `usePokerGame` and `GameContextValue` (`game`, `dispatch`, `apply`, `run`, `handleError`, `refetch`, `sessionExpired`, `online`, `presence`, `serverOffset`); components `GameHeader` (prop `actions`), `GameMenu`, `GameSettingsDialog`, `DeckFields`, `PlayersGrid`, `Hand`, `FacilitatorToolbar`, `ResultPanel`, `NewPokerGameDialog`, `PokerGamesSection`; `Game` renders its main pane in a `<main ref={setMainPane}>` element (10b mounts the cursor layer inside it).

---

### Task 1: Shared guest identity (`HasGuestIdentity`, scoped `GuestCookie`)

**Files:**
- Create: `app/Concerns/HasGuestIdentity.php`
- Modify: `app/Models/Participant.php` (drop `isGuest`, `displayName`, `avatarSeed`, `avatarUrl`; `use HasGuestIdentity;`), `app/Actions/Retros/GuestCookie.php`, `app/Actions/Retros/ResolveParticipant.php`, `app/Http/Middleware/ResolveRetroParticipant.php`, `app/Http/Controllers/RetroJoinsController.php`, `tests/Pest.php` (`retroGuestCookie`), `tests/Feature/Retros/GuestJoinTest.php`
- Test: create `tests/Feature/Poker/GuestIdentityTest.php`

**Interfaces:**
- Consumes: `Participant` (`id`, `user_id`, `guest_name`, relation `user`).
- Produces: trait `App\Concerns\HasGuestIdentity` with `isGuest(): bool` (`guest_name !== null`), `displayName(): string` (user name, else guest name, else `__('Former member')`), `avatarSeed(): string` (`substr(hash_hmac('sha256', $this->user_id ?? $this->id, (string) config('app.key')), 0, 32)`), `avatarUrl(): string` (`route('avatars.show', $this->avatarSeed(), absolute: false)`) — the using model must define a `user()` BelongsTo. `GuestCookie::RetroScope = 'retro'`, `GuestCookie::PokerScope = 'poker'`, `GuestCookie::name(string $scope, string $scopeId): string` (`"{$scope}_guest_{$scopeId}"`), `GuestCookie::make(string $scope, string $scopeId, string $playerId, string $secret): Cookie`, `GuestCookie::parse(mixed $value): ?array` (unchanged).
- Tests required: "keeps the retro avatar seed and cookie name", "names poker guest cookies separately". Existing retro suites (`GuestJoinTest`, `RetroAccessTest`, `BroadcastAuthorizationTest`, `AvatarsTest`) must pass unchanged in behaviour.

- [ ] **Step 1: Create the branch**

```bash
git switch feat/plan-9-action-items-v2
git switch -c feat/plan-10-planning-poker
```

- [ ] **Step 2: Write the failing test**

Create `tests/Feature/Poker/GuestIdentityTest.php`:

```php
<?php

use App\Actions\Retros\GuestCookie;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Support\Str;

function guestIdentitySeed(string $identity): string
{
    return substr(hash_hmac('sha256', $identity, (string) config('app.key')), 0, 32);
}

it('keeps the retro avatar seed and cookie name', function () {
    $retro = Retro::factory()->create();
    [$user, $member] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Visitor']);
    $formerMember = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => null]);

    expect($member->avatarSeed())->toBe(guestIdentitySeed($user->id))
        ->and($member->avatarUrl())->toBe(route('avatars.show', guestIdentitySeed($user->id), absolute: false))
        ->and($member->isGuest())->toBeFalse()
        ->and($member->displayName())->toBe($user->name)
        ->and($guest->avatarSeed())->toBe(guestIdentitySeed($guest->id))
        ->and($guest->isGuest())->toBeTrue()
        ->and($guest->displayName())->toBe('Visitor')
        ->and($formerMember->displayName())->toBe('Former member')
        ->and(GuestCookie::name(GuestCookie::RetroScope, $retro->id))->toBe("retro_guest_{$retro->id}");
});

it('names poker guest cookies separately', function () {
    $gameId = (string) Str::uuid();
    $playerId = (string) Str::uuid();

    $cookie = GuestCookie::make(GuestCookie::PokerScope, $gameId, $playerId, 'secret');

    expect(GuestCookie::name(GuestCookie::PokerScope, $gameId))->toBe("poker_guest_{$gameId}")
        ->and(GuestCookie::name(GuestCookie::PokerScope, $gameId))->not->toBe(GuestCookie::name(GuestCookie::RetroScope, $gameId))
        ->and($cookie->getName())->toBe("poker_guest_{$gameId}")
        ->and($cookie->getValue())->toBe("{$playerId}|secret")
        ->and(GuestCookie::parse($cookie->getValue()))->toBe([$playerId, 'secret']);
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/GuestIdentityTest.php`
Expected: FAIL — `Undefined constant App\Actions\Retros\GuestCookie::RetroScope`.

- [ ] **Step 4: Create the trait**

Create `app/Concerns/HasGuestIdentity.php`:

```php
<?php

namespace App\Concerns;

use App\Models\User;

/**
 * Identity shared by retro participants and poker players: a team member
 * (user) or a guest (display name), with a stable avatar per identity.
 *
 * @property string $id
 * @property string|null $user_id
 * @property string|null $guest_name
 * @property-read User|null $user
 */
trait HasGuestIdentity
{
    public function isGuest(): bool
    {
        return $this->guest_name !== null;
    }

    public function displayName(): string
    {
        if ($this->user !== null) {
            return $this->user->name;
        }

        return $this->guest_name ?? __('Former member');
    }

    public function avatarSeed(): string
    {
        $identity = $this->user_id ?? $this->id;

        return substr(hash_hmac('sha256', $identity, (string) config('app.key')), 0, 32);
    }

    public function avatarUrl(): string
    {
        return route('avatars.show', $this->avatarSeed(), absolute: false);
    }
}
```

- [ ] **Step 5: Use it in `Participant`**

In `app/Models/Participant.php` add `use App\Concerns\HasGuestIdentity;` to the imports, add the trait after `use HasFactory;`:

```php
    /** @use HasFactory<ParticipantFactory> */
    use HasFactory;

    use HasGuestIdentity;
    use HasUuids;
```

and delete the four methods `isGuest()`, `displayName()`, `avatarSeed()` and `avatarUrl()` (the trait now provides them with the same bodies).

- [ ] **Step 6: Scope `GuestCookie`**

Replace `app/Actions/Retros/GuestCookie.php` with:

```php
<?php

namespace App\Actions\Retros;

use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Cookie;

class GuestCookie
{
    public const RetroScope = 'retro';

    public const PokerScope = 'poker';

    private const LifetimeMinutes = 60 * 24 * 30;

    /** @return non-empty-string */
    public static function name(string $scope, string $scopeId): string
    {
        return "{$scope}_guest_{$scopeId}";
    }

    public static function make(string $scope, string $scopeId, string $playerId, string $secret): Cookie
    {
        return cookie(self::name($scope, $scopeId), "{$playerId}|{$secret}", self::LifetimeMinutes);
    }

    /**
     * @return array{0: string, 1: string}|null
     */
    public static function parse(mixed $value): ?array
    {
        if (! is_string($value)) {
            return null;
        }

        $parts = explode('|', $value, 2);

        if (count($parts) !== 2) {
            return null;
        }

        if (! Str::isUuid($parts[0])) {
            return null;
        }

        if ($parts[1] === '') {
            return null;
        }

        return [$parts[0], $parts[1]];
    }
}
```

- [ ] **Step 7: Update the callers**

`app/Actions/Retros/ResolveParticipant.php`, in `guest()`:

```php
        $credentials = GuestCookie::parse($request->cookie(GuestCookie::name(GuestCookie::RetroScope, $retro->id)));
```

`app/Http/Middleware/ResolveRetroParticipant.php`, in `handle()`:

```php
            $hasGuestCookie = $request->cookies->has(GuestCookie::name(GuestCookie::RetroScope, $retro->id));
```

`app/Http/Controllers/RetroJoinsController.php`, last line of `store()`:

```php
        return to_route('retros.show', $retro)->withCookie(GuestCookie::make(GuestCookie::RetroScope, $retro->id, $participant->id, $secret));
```

`tests/Pest.php`, `retroGuestCookie()`:

```php
function retroGuestCookie(Participant $participant, string $secret = 'secret'): array
{
    return [GuestCookie::name(GuestCookie::RetroScope, $participant->retro_id) => "{$participant->id}|{$secret}"];
}
```

`tests/Feature/Retros/GuestJoinTest.php` — replace the three `GuestCookie::name($retro->id)` calls in "joins as a guest and resumes with the cookie" with `GuestCookie::name(GuestCookie::RetroScope, $retro->id)`:

```php
    $response = $this->post(route('retros.join.store', $retro->guest_token), ['name' => 'Visitor'])
        ->assertRedirect(route('retros.show', $retro))
        ->assertCookie(GuestCookie::name(GuestCookie::RetroScope, $retro->id));

    $guest = $retro->participants()->where('guest_name', 'Visitor')->sole();
    $cookieValue = $response->getCookie(GuestCookie::name(GuestCookie::RetroScope, $retro->id), decrypt: true)->getValue();

    expect(str_starts_with($cookieValue, $guest->id.'|'))->toBeTrue()
        ->and($guest->guest_secret_hash)->not->toContain(explode('|', $cookieValue)[1]);

    $this->withCookies([GuestCookie::name(GuestCookie::RetroScope, $retro->id) => $cookieValue])
        ->get(route('retros.join.show', $retro->guest_token))
        ->assertRedirect(route('retros.show', $retro));
```

Check nothing else still calls the one-argument form:

Run: `grep -rn "GuestCookie::name(\$\|GuestCookie::make(\$" app tests`
Expected: no output.

- [ ] **Step 8: Run the new and the retro regression tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/GuestIdentityTest.php tests/Feature/Retros/GuestJoinTest.php tests/Feature/Retros/RetroAccessTest.php tests/Feature/Retros/BroadcastAuthorizationTest.php tests/Feature/Retros/AvatarsTest.php`
Expected: PASS.

- [ ] **Step 9: Format and analyse**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress`
Expected: pint fixes nothing or only whitespace; phpstan `[OK] No errors`.

- [ ] **Step 10: Commit**

```bash
git add app/Concerns/HasGuestIdentity.php app/Models/Participant.php app/Actions/Retros/GuestCookie.php app/Actions/Retros/ResolveParticipant.php app/Http/Middleware/ResolveRetroParticipant.php app/Http/Controllers/RetroJoinsController.php tests/Pest.php tests/Feature/Retros/GuestJoinTest.php tests/Feature/Poker/GuestIdentityTest.php
git commit -m "refactor: share guest identity and scope guest cookies

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

### Task 2: Poker schema, enums, models and factories

**Files:**
- Create: `database/migrations/2026_10_03_100000_create_poker_tables.php`, `app/Enums/PokerDeck.php`, `app/Enums/PokerRevealReason.php`, `app/Models/{PokerGame,PokerPlayer,PokerTask,PokerRound,PokerVote}.php`, `database/factories/{PokerGameFactory,PokerPlayerFactory,PokerTaskFactory,PokerRoundFactory,PokerVoteFactory}.php`
- Modify: `app/Models/Team.php` (`pokerGames(): HasMany`), `tests/Pest.php` (helpers below), `lang/{en,fr,es,de}.json` (deck labels)
- Test: create `tests/Unit/Poker/PokerDeckTest.php`, `tests/Feature/Poker/PokerModelTest.php`

**Interfaces:**
- Consumes: `teams`, `users` tables; `HasGuestIdentity` (Task 1).
- Produces:
  - One migration creating, in order: `poker_games` (all spec §2 columns; `facilitator_player_id` and `current_task_id` as plain nullable `uuid` columns first), `poker_players`, `poker_tasks`, `poker_rounds`, `poker_votes`, then `Schema::table('poker_games', …)` adding the two foreign keys (`facilitator_player_id` → `poker_players` null on delete, `current_task_id` → `poker_tasks` null on delete). All ids `uuid('id')->primary()`; FKs `foreignUuid(...)->constrained(...)`; indexes and uniques exactly as spec §2. `poker_tasks.estimate_numeric` = `decimal(8, 2)`. `poker_rounds.version` = `unsignedInteger` default 0. `poker_decks` is NOT created here (Plan 10b).
  - `App\Enums\PokerDeck: string` — cases `Fibonacci`, `ModifiedFibonacci`, `Tshirt`, `PowersOfTwo`, `Custom`; constants `UnknownCard = '?'`, `CoffeeCard = '☕'`; `cards(): array<int, string>`; `label(): string`; `static numericValue(string $card): ?float`; `static isSpecial(string $card): bool`; `static isNumericDeck(array $cards): bool`; `static options(): array<int, array{value: string, label: string, cards: array<int, string>}>`.
  - `App\Enums\PokerRevealReason: string` — `Manual = 'manual'`, `EveryoneVoted = 'everyone_voted'`, `Timer = 'timer'`.
  - Models `PokerGame`, `PokerPlayer`, `PokerTask`, `PokerRound`, `PokerVote` exactly as in the code below (relations, casts, `$touches`, helper methods of the outline: `PokerGame::{isEnded, isFacilitator, isNumeric, deckLabel, hasVotes, latestRoundOfCurrentTask}`, `PokerPlayer::current(Request)`, `PokerTask::latestRound()`, `PokerRound::isRevealed()`), `Team::pokerGames()`.
  - Factories: `PokerGameFactory` (states `withGuestAccess()`, `ended()`, `deck(PokerDeck $deck)`, `customCards(array $cards)`), `PokerPlayerFactory` (states `guest(string $secret = 'secret')`, `spectator()`), `PokerTaskFactory` (state `estimated(string $value = '5')`), `PokerRoundFactory` (state `revealed()`), `PokerVoteFactory`.
  - Pest helpers: `pokerMember(PokerGame $game): array{0: User, 1: PokerPlayer}`, `pokerFacilitator(PokerGame $game): array{0: User, 1: PokerPlayer}`, `pokerGuest(PokerGame $game, string $secret = 'secret'): PokerPlayer`, `pokerGuestCookie(PokerPlayer $player, string $secret = 'secret'): array<string, string>`, `openPokerRound(PokerGame $game, ?PokerTask $task = null): PokerRound` (creates a task when null, creates the task's next round — round 1 for a new task —, sets `current_task_id`), `pokerVote(PokerRound $round, PokerPlayer $player, string $value): PokerVote`.
- Tests required: PokerDeck unit tests; feature: "cascades deletes from game to votes", "clears facilitator and current task when their rows go", "touches the game when a vote changes", "labels saved decks by name".

- [ ] **Step 1: Write the failing unit test for the decks**

Create `tests/Unit/Poker/PokerDeckTest.php` (pure: no Laravel app, so `label()` is tested in the feature test):

```php
<?php

use App\Enums\PokerDeck;

it('lists the cards of each built-in deck', function () {
    expect(PokerDeck::Fibonacci->cards())->toBe(['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?', '☕'])
        ->and(PokerDeck::ModifiedFibonacci->cards())->toBe(['0', '½', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'])
        ->and(PokerDeck::Tshirt->cards())->toBe(['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'])
        ->and(PokerDeck::PowersOfTwo->cards())->toBe(['0', '1', '2', '4', '8', '16', '32', '64', '?', '☕'])
        ->and(PokerDeck::Custom->cards())->toBe([]);
});

it('parses numeric card values', function (string $card, ?float $value) {
    expect(PokerDeck::numericValue($card))->toBe($value);
})->with([
    ['½', 0.5],
    ['13', 13.0],
    ['0.5', 0.5],
    ['0', 0.0],
    ['XS', null],
    ['?', null],
    ['☕', null],
    ['-1', null],
    ['1.', null],
]);

it('recognises special cards', function () {
    expect(PokerDeck::isSpecial('?'))->toBeTrue()
        ->and(PokerDeck::isSpecial('☕'))->toBeTrue()
        ->and(PokerDeck::isSpecial('3'))->toBeFalse()
        ->and(PokerDeck::UnknownCard)->toBe('?')
        ->and(PokerDeck::CoffeeCard)->toBe('☕');
});

it('tells numeric decks apart', function () {
    expect(PokerDeck::isNumericDeck(PokerDeck::Fibonacci->cards()))->toBeTrue()
        ->and(PokerDeck::isNumericDeck(PokerDeck::ModifiedFibonacci->cards()))->toBeTrue()
        ->and(PokerDeck::isNumericDeck(PokerDeck::PowersOfTwo->cards()))->toBeTrue()
        ->and(PokerDeck::isNumericDeck(PokerDeck::Tshirt->cards()))->toBeFalse()
        ->and(PokerDeck::isNumericDeck(['1', '2.5', '4', '?']))->toBeTrue()
        ->and(PokerDeck::isNumericDeck(['1', 'big', '?']))->toBeFalse();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Unit/Poker/PokerDeckTest.php`
Expected: FAIL — `Class "App\Enums\PokerDeck" not found`.

- [ ] **Step 3: Create the enums**

Create `app/Enums/PokerDeck.php`:

```php
<?php

namespace App\Enums;

enum PokerDeck: string
{
    case Fibonacci = 'fibonacci';
    case ModifiedFibonacci = 'modified_fibonacci';
    case Tshirt = 'tshirt';
    case PowersOfTwo = 'powers_of_two';
    case Custom = 'custom';

    public const UnknownCard = '?';

    public const CoffeeCard = '☕';

    /**
     * @return array<int, string>
     */
    public function cards(): array
    {
        return match ($this) {
            self::Fibonacci => ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', self::UnknownCard, self::CoffeeCard],
            self::ModifiedFibonacci => ['0', '½', '1', '2', '3', '5', '8', '13', '20', '40', '100', self::UnknownCard, self::CoffeeCard],
            self::Tshirt => ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', self::UnknownCard, self::CoffeeCard],
            self::PowersOfTwo => ['0', '1', '2', '4', '8', '16', '32', '64', self::UnknownCard, self::CoffeeCard],
            self::Custom => [],
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Fibonacci => __('Fibonacci'),
            self::ModifiedFibonacci => __('Modified Fibonacci'),
            self::Tshirt => __('T-shirt sizes'),
            self::PowersOfTwo => __('Powers of 2'),
            self::Custom => __('Custom'),
        };
    }

    public static function numericValue(string $card): ?float
    {
        if ($card === '½') {
            return 0.5;
        }

        if (preg_match('/^\d+(\.\d+)?$/', $card) !== 1) {
            return null;
        }

        return (float) $card;
    }

    public static function isSpecial(string $card): bool
    {
        return $card === self::UnknownCard || $card === self::CoffeeCard;
    }

    /**
     * @param  array<int, string>  $cards
     */
    public static function isNumericDeck(array $cards): bool
    {
        foreach ($cards as $card) {
            if (self::isSpecial($card)) {
                continue;
            }

            if (self::numericValue($card) === null) {
                return false;
            }
        }

        return true;
    }

    /**
     * @return array<int, array{
     *     value: string,
     *     label: string,
     *     cards: array<int, string>
     * }>
     */
    public static function options(): array
    {
        return array_map(fn (self $deck): array => [
            'value' => $deck->value,
            'label' => $deck->label(),
            'cards' => $deck->cards(),
        ], [self::Fibonacci, self::ModifiedFibonacci, self::Tshirt, self::PowersOfTwo, self::Custom]);
    }
}
```

Create `app/Enums/PokerRevealReason.php`:

```php
<?php

namespace App\Enums;

enum PokerRevealReason: string
{
    case Manual = 'manual';
    case EveryoneVoted = 'everyone_voted';
    case Timer = 'timer';
}
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `vendor/bin/sail artisan test --compact tests/Unit/Poker/PokerDeckTest.php`
Expected: PASS.

- [ ] **Step 5: Pest helpers**

In `tests/Pest.php` add to the imports:

```php
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\PokerVote;
```

and append:

```php
/**
 * @return array{0: User, 1: PokerPlayer}
 */
function pokerMember(PokerGame $game): array
{
    $user = teamMember($game->team);

    return [$user, PokerPlayer::factory()->create(['poker_game_id' => $game->id, 'user_id' => $user->id])];
}

/**
 * @return array{0: User, 1: PokerPlayer}
 */
function pokerFacilitator(PokerGame $game): array
{
    [$user, $player] = pokerMember($game);

    $game->forceFill(['facilitator_player_id' => $player->id])->save();

    return [$user, $player];
}

function pokerGuest(PokerGame $game, string $secret = 'secret'): PokerPlayer
{
    return PokerPlayer::factory()->guest($secret)->create(['poker_game_id' => $game->id]);
}

/**
 * @return array<string, string>
 */
function pokerGuestCookie(PokerPlayer $player, string $secret = 'secret'): array
{
    return [GuestCookie::name(GuestCookie::PokerScope, $player->poker_game_id) => "{$player->id}|{$secret}"];
}

function openPokerRound(PokerGame $game, ?PokerTask $task = null): PokerRound
{
    $task ??= PokerTask::factory()->create(['poker_game_id' => $game->id]);

    $round = PokerRound::factory()->create([
        'poker_task_id' => $task->id,
        'anonymous' => $game->anonymous_votes,
    ]);

    $game->forceFill(['current_task_id' => $task->id])->save();

    return $round;
}

function pokerVote(PokerRound $round, PokerPlayer $player, string $value): PokerVote
{
    return PokerVote::factory()->create([
        'poker_round_id' => $round->id,
        'poker_player_id' => $player->id,
        'value' => $value,
    ]);
}
```

- [ ] **Step 6: Write the failing feature test**

Create `tests/Feature/Poker/PokerModelTest.php`:

```php
<?php

use App\Enums\PokerDeck;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\PokerVote;

it('cascades deletes from game to votes', function () {
    $game = PokerGame::factory()->create();
    [, $player] = pokerFacilitator($game);
    $round = openPokerRound($game);
    pokerVote($round, $player, '5');

    $game->delete();

    expect(PokerPlayer::query()->count())->toBe(0)
        ->and(PokerTask::query()->count())->toBe(0)
        ->and(PokerRound::query()->count())->toBe(0)
        ->and(PokerVote::query()->count())->toBe(0);
});

it('clears facilitator and current task when their rows go', function () {
    $game = PokerGame::factory()->create();
    [, $player] = pokerFacilitator($game);
    $round = openPokerRound($game);

    $player->delete();
    $round->task->delete();

    expect($game->fresh()->facilitator_player_id)->toBeNull()
        ->and($game->fresh()->current_task_id)->toBeNull();
});

it('touches the game when a vote changes', function () {
    $game = PokerGame::factory()->create();
    [, $player] = pokerMember($game);
    $round = openPokerRound($game);

    $this->travelTo(now()->addMinutes(10)->startOfSecond());

    $vote = pokerVote($round, $player, '3');

    expect($game->fresh()->updated_at->toDateTimeString())->toBe(now()->toDateTimeString());

    $this->travelTo(now()->addMinutes(5));

    $vote->delete();

    expect($game->fresh()->updated_at->toDateTimeString())->toBe(now()->toDateTimeString());
});

it('labels saved decks by name', function () {
    $saved = PokerGame::factory()->customCards(['1', '2', '3'])->create(['deck_name' => 'Team scale']);
    $builtIn = PokerGame::factory()->deck(PokerDeck::Tshirt)->create();

    expect($saved->deckLabel())->toBe('Team scale')
        ->and($builtIn->deckLabel())->toBe('T-shirt sizes')
        ->and($builtIn->isNumeric())->toBeFalse()
        ->and(PokerGame::factory()->create()->isNumeric())->toBeTrue();
});

it('finds the latest round of the current task and whether votes exist', function () {
    $game = PokerGame::factory()->create();
    [, $player] = pokerMember($game);
    $first = openPokerRound($game);

    expect($game->fresh()->hasVotes())->toBeFalse();

    $second = openPokerRound($game, $first->task);
    pokerVote($second, $player, '8');

    $fresh = $game->fresh();

    expect($second->number)->toBe(2)
        ->and($fresh->latestRoundOfCurrentTask()?->id)->toBe($second->id)
        ->and($fresh->hasVotes())->toBeTrue()
        ->and($fresh->rounds()->count())->toBe(2)
        ->and($fresh->isEnded())->toBeFalse()
        ->and($fresh->guest_token)->toHaveLength(40)
        ->and($fresh->toArray())->not->toHaveKey('guest_token');
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerModelTest.php`
Expected: FAIL — `Class "App\Models\PokerGame" not found`.

- [ ] **Step 8: Migration**

Create `database/migrations/2026_10_03_100000_create_poker_tables.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('poker_games', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->string('title', 120);
            $table->string('deck', 30);
            $table->json('cards');
            $table->string('deck_name', 40)->nullable();
            $table->uuid('facilitator_player_id')->nullable();
            $table->uuid('current_task_id')->nullable();
            $table->boolean('guest_access_enabled')->default(false);
            $table->string('guest_token', 40)->unique();
            $table->timestamp('ended_at')->nullable();
            $table->boolean('auto_reveal')->default(false);
            $table->boolean('anonymous_votes')->default(false);
            $table->boolean('cursors_enabled')->default(true);
            $table->boolean('reactions_enabled')->default(true);
            $table->timestamps();

            $table->index(['team_id', 'ended_at']);
        });

        Schema::create('poker_players', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('poker_game_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('guest_name', 50)->nullable();
            $table->string('guest_secret_hash', 64)->nullable();
            $table->boolean('is_spectator')->default(false);
            $table->timestamps();

            $table->unique(['poker_game_id', 'user_id']);
        });

        Schema::create('poker_tasks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('poker_game_id')->constrained()->cascadeOnDelete();
            $table->string('title', 200);
            $table->text('description')->nullable();
            $table->unsignedInteger('position');
            $table->string('estimate', 8)->nullable();
            $table->decimal('estimate_numeric', 8, 2)->nullable();
            $table->timestamp('estimated_at')->nullable();
            $table->string('external_source', 20)->nullable();
            $table->string('external_id', 100)->nullable();
            $table->string('external_url', 2048)->nullable();
            $table->timestamps();

            $table->unique(['poker_game_id', 'external_source', 'external_id']);
            $table->index(['poker_game_id', 'position']);
        });

        Schema::create('poker_rounds', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('poker_task_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('number');
            $table->timestamp('revealed_at')->nullable();
            $table->unsignedInteger('version')->default(0);
            $table->boolean('anonymous')->default(false);
            $table->timestamp('timer_ends_at')->nullable();
            $table->string('reveal_reason', 20)->nullable();
            $table->timestamps();

            $table->unique(['poker_task_id', 'number']);
        });

        Schema::create('poker_votes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('poker_round_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('poker_player_id')->constrained()->cascadeOnDelete();
            $table->string('value', 8);
            $table->timestamps();

            $table->unique(['poker_round_id', 'poker_player_id']);
        });

        Schema::table('poker_games', function (Blueprint $table) {
            $table->foreign('facilitator_player_id')->references('id')->on('poker_players')->nullOnDelete();
            $table->foreign('current_task_id')->references('id')->on('poker_tasks')->nullOnDelete();
        });
    }
};
```

- [ ] **Step 9: Models**

Create `app/Models/PokerGame.php`:

```php
<?php

namespace App\Models;

use App\Enums\PokerDeck;
use Database\Factories\PokerGameFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $team_id
 * @property string $title
 * @property PokerDeck $deck
 * @property array<int, string> $cards
 * @property string|null $deck_name
 * @property string|null $facilitator_player_id
 * @property string|null $current_task_id
 * @property bool $guest_access_enabled
 * @property string $guest_token
 * @property Carbon|null $ended_at
 * @property bool $auto_reveal
 * @property bool $anonymous_votes
 * @property bool $cursors_enabled
 * @property bool $reactions_enabled
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Team $team
 * @property-read PokerTask|null $currentTask
 */
#[Fillable([
    'title', 'deck', 'cards', 'deck_name', 'facilitator_player_id', 'current_task_id',
    'guest_access_enabled', 'guest_token', 'ended_at',
    'auto_reveal', 'anonymous_votes', 'cursors_enabled', 'reactions_enabled',
])]
#[Hidden(['guest_token'])]
class PokerGame extends Model
{
    /** @use HasFactory<PokerGameFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /** @return HasMany<PokerPlayer, $this> */
    public function players(): HasMany
    {
        return $this->hasMany(PokerPlayer::class)->orderBy('created_at')->orderBy('id');
    }

    /** @return HasMany<PokerTask, $this> */
    public function tasks(): HasMany
    {
        return $this->hasMany(PokerTask::class)->orderBy('position');
    }

    /** @return HasManyThrough<PokerRound, PokerTask, $this> */
    public function rounds(): HasManyThrough
    {
        return $this->hasManyThrough(PokerRound::class, PokerTask::class);
    }

    /** @return BelongsTo<PokerPlayer, $this> */
    public function facilitator(): BelongsTo
    {
        return $this->belongsTo(PokerPlayer::class, 'facilitator_player_id');
    }

    /** @return BelongsTo<PokerTask, $this> */
    public function currentTask(): BelongsTo
    {
        return $this->belongsTo(PokerTask::class, 'current_task_id');
    }

    public function isEnded(): bool
    {
        return $this->ended_at !== null;
    }

    public function isFacilitator(PokerPlayer $player): bool
    {
        return $this->facilitator_player_id === $player->id;
    }

    public function isNumeric(): bool
    {
        return PokerDeck::isNumericDeck($this->cards);
    }

    public function deckLabel(): string
    {
        return $this->deck_name ?? $this->deck->label();
    }

    public function hasVotes(): bool
    {
        return PokerVote::query()
            ->whereIn('poker_round_id', PokerRound::query()
                ->select('poker_rounds.id')
                ->whereIn('poker_task_id', PokerTask::query()->select('id')->where('poker_game_id', $this->id)))
            ->exists();
    }

    public function latestRoundOfCurrentTask(): ?PokerRound
    {
        if ($this->current_task_id === null) {
            return null;
        }

        return $this->currentTask?->latestRound;
    }

    protected function casts(): array
    {
        return [
            'deck' => PokerDeck::class,
            'cards' => 'array',
            'guest_access_enabled' => 'boolean',
            'auto_reveal' => 'boolean',
            'anonymous_votes' => 'boolean',
            'cursors_enabled' => 'boolean',
            'reactions_enabled' => 'boolean',
            'ended_at' => 'datetime',
        ];
    }
}
```

Create `app/Models/PokerPlayer.php`:

```php
<?php

namespace App\Models;

use App\Concerns\HasGuestIdentity;
use Database\Factories\PokerPlayerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $poker_game_id
 * @property string|null $user_id
 * @property string|null $guest_name
 * @property string|null $guest_secret_hash
 * @property bool $is_spectator
 * @property Carbon|null $created_at
 * @property-read PokerGame $game
 * @property-read User|null $user
 */
#[Fillable(['poker_game_id', 'user_id', 'guest_name', 'guest_secret_hash', 'is_spectator'])]
#[Hidden(['guest_secret_hash'])]
class PokerPlayer extends Model
{
    /** @use HasFactory<PokerPlayerFactory> */
    use HasFactory;

    use HasGuestIdentity;
    use HasUuids;

    public static function current(Request $request): self
    {
        $player = $request->attributes->get('pokerPlayer');

        abort_unless($player instanceof self, 403);

        return $player;
    }

    /** @return BelongsTo<PokerGame, $this> */
    public function game(): BelongsTo
    {
        return $this->belongsTo(PokerGame::class, 'poker_game_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<PokerVote, $this> */
    public function votes(): HasMany
    {
        return $this->hasMany(PokerVote::class);
    }

    protected function casts(): array
    {
        return [
            'is_spectator' => 'boolean',
        ];
    }
}
```

Create `app/Models/PokerTask.php`:

```php
<?php

namespace App\Models;

use Database\Factories\PokerTaskFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * The external_* columns are written only by the tracker imports of
 * spec 6, never from a request, so they are not fillable.
 *
 * @property string $id
 * @property string $poker_game_id
 * @property string $title
 * @property string|null $description
 * @property int $position
 * @property string|null $estimate
 * @property float|null $estimate_numeric
 * @property Carbon|null $estimated_at
 * @property string|null $external_source
 * @property string|null $external_id
 * @property string|null $external_url
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read PokerGame $game
 * @property-read PokerRound|null $latestRound
 */
#[Fillable(['title', 'description', 'position', 'estimate', 'estimate_numeric', 'estimated_at'])]
class PokerTask extends Model
{
    /** @use HasFactory<PokerTaskFactory> */
    use HasFactory;

    use HasUuids;

    /** @var list<string> */
    protected $touches = ['game'];

    /** @return BelongsTo<PokerGame, $this> */
    public function game(): BelongsTo
    {
        return $this->belongsTo(PokerGame::class, 'poker_game_id');
    }

    /** @return HasMany<PokerRound, $this> */
    public function rounds(): HasMany
    {
        return $this->hasMany(PokerRound::class)->orderBy('number');
    }

    /** @return HasOne<PokerRound, $this> */
    public function latestRound(): HasOne
    {
        return $this->hasOne(PokerRound::class)->latestOfMany('number');
    }

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'estimate_numeric' => 'float',
            'estimated_at' => 'datetime',
        ];
    }
}
```

Create `app/Models/PokerRound.php`:

```php
<?php

namespace App\Models;

use App\Enums\PokerRevealReason;
use Database\Factories\PokerRoundFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $poker_task_id
 * @property int $number
 * @property Carbon|null $revealed_at
 * @property int $version
 * @property bool $anonymous
 * @property Carbon|null $timer_ends_at
 * @property PokerRevealReason|null $reveal_reason
 * @property Carbon|null $created_at
 * @property-read PokerTask $task
 */
#[Fillable(['number', 'revealed_at', 'version', 'anonymous', 'timer_ends_at', 'reveal_reason'])]
class PokerRound extends Model
{
    /** @use HasFactory<PokerRoundFactory> */
    use HasFactory;

    use HasUuids;

    /** @var list<string> */
    protected $touches = ['task'];

    /** @return BelongsTo<PokerTask, $this> */
    public function task(): BelongsTo
    {
        return $this->belongsTo(PokerTask::class, 'poker_task_id');
    }

    /** @return HasMany<PokerVote, $this> */
    public function votes(): HasMany
    {
        return $this->hasMany(PokerVote::class);
    }

    public function isRevealed(): bool
    {
        return $this->revealed_at !== null;
    }

    protected function casts(): array
    {
        return [
            'number' => 'integer',
            'version' => 'integer',
            'anonymous' => 'boolean',
            'revealed_at' => 'datetime',
            'timer_ends_at' => 'datetime',
            'reveal_reason' => PokerRevealReason::class,
        ];
    }
}
```

Create `app/Models/PokerVote.php`:

```php
<?php

namespace App\Models;

use Database\Factories\PokerVoteFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $poker_round_id
 * @property string $poker_player_id
 * @property string $value
 * @property-read PokerRound $round
 * @property-read PokerPlayer $player
 */
#[Fillable(['poker_round_id', 'poker_player_id', 'value'])]
class PokerVote extends Model
{
    /** @use HasFactory<PokerVoteFactory> */
    use HasFactory;

    use HasUuids;

    /** @var list<string> */
    protected $touches = ['round'];

    /** @return BelongsTo<PokerRound, $this> */
    public function round(): BelongsTo
    {
        return $this->belongsTo(PokerRound::class, 'poker_round_id');
    }

    /** @return BelongsTo<PokerPlayer, $this> */
    public function player(): BelongsTo
    {
        return $this->belongsTo(PokerPlayer::class, 'poker_player_id');
    }
}
```

In `app/Models/Team.php` add after `retros()`:

```php
    /** @return HasMany<PokerGame, $this> */
    public function pokerGames(): HasMany
    {
        return $this->hasMany(PokerGame::class);
    }
```

- [ ] **Step 10: Factories**

Create `database/factories/PokerGameFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\PokerDeck;
use App\Models\PokerGame;
use App\Models\Team;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<PokerGame>
 */
class PokerGameFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'title' => fake()->sentence(3),
            'deck' => PokerDeck::Fibonacci,
            'cards' => PokerDeck::Fibonacci->cards(),
            'guest_token' => Str::random(40),
        ];
    }

    public function withGuestAccess(): static
    {
        return $this->state(fn () => ['guest_access_enabled' => true]);
    }

    public function ended(): static
    {
        return $this->state(fn () => ['ended_at' => now(), 'current_task_id' => null]);
    }

    public function deck(PokerDeck $deck): static
    {
        return $this->state(fn () => ['deck' => $deck, 'cards' => $deck->cards()]);
    }

    /**
     * @param  array<int, string>  $cards
     */
    public function customCards(array $cards): static
    {
        return $this->state(fn () => ['deck' => PokerDeck::Custom, 'cards' => $cards]);
    }
}
```

Create `database/factories/PokerPlayerFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PokerPlayer>
 */
class PokerPlayerFactory extends Factory
{
    public function definition(): array
    {
        return [
            'poker_game_id' => PokerGame::factory(),
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

    public function spectator(): static
    {
        return $this->state(fn () => ['is_spectator' => true]);
    }
}
```

Create `database/factories/PokerTaskFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\PokerDeck;
use App\Models\PokerGame;
use App\Models\PokerTask;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PokerTask>
 */
class PokerTaskFactory extends Factory
{
    public function definition(): array
    {
        return [
            'poker_game_id' => PokerGame::factory(),
            'title' => fake()->sentence(4),
            'position' => fn (array $attributes) => (int) PokerTask::query()
                ->where('poker_game_id', $attributes['poker_game_id'])
                ->max('position') + 1,
        ];
    }

    public function estimated(string $value = '5'): static
    {
        return $this->state(fn () => [
            'estimate' => $value,
            'estimate_numeric' => PokerDeck::numericValue($value),
            'estimated_at' => now(),
        ]);
    }
}
```

Create `database/factories/PokerRoundFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\PokerRevealReason;
use App\Models\PokerRound;
use App\Models\PokerTask;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PokerRound>
 */
class PokerRoundFactory extends Factory
{
    public function definition(): array
    {
        return [
            'poker_task_id' => PokerTask::factory(),
            'number' => fn (array $attributes) => (int) PokerRound::query()
                ->where('poker_task_id', $attributes['poker_task_id'])
                ->max('number') + 1,
        ];
    }

    public function revealed(): static
    {
        return $this->state(fn () => [
            'revealed_at' => now(),
            'reveal_reason' => PokerRevealReason::Manual,
        ]);
    }
}
```

Create `database/factories/PokerVoteFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerVote;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PokerVote>
 */
class PokerVoteFactory extends Factory
{
    public function definition(): array
    {
        return [
            'poker_round_id' => PokerRound::factory(),
            'poker_player_id' => fn (array $attributes) => PokerPlayer::factory()->create([
                'poker_game_id' => PokerRound::query()->findOrFail($attributes['poker_round_id'])->task->poker_game_id,
            ])->id,
            'value' => '3',
        ];
    }
}
```

- [ ] **Step 11: Translations**

Append to each `lang/*.json` (before the closing `}`, adding a comma to the previous last line; add only keys missing at execution time):

`lang/en.json`:
```json
    "Fibonacci": "Fibonacci",
    "Modified Fibonacci": "Modified Fibonacci",
    "T-shirt sizes": "T-shirt sizes",
    "Powers of 2": "Powers of 2",
    "Custom": "Custom"
```

`lang/fr.json`:
```json
    "Fibonacci": "Fibonacci",
    "Modified Fibonacci": "Fibonacci modifiée",
    "T-shirt sizes": "Tailles de t-shirt",
    "Powers of 2": "Puissances de 2",
    "Custom": "Personnalisé"
```

`lang/es.json`:
```json
    "Fibonacci": "Fibonacci",
    "Modified Fibonacci": "Fibonacci modificada",
    "T-shirt sizes": "Tallas de camiseta",
    "Powers of 2": "Potencias de 2",
    "Custom": "Personalizada"
```

`lang/de.json`:
```json
    "Fibonacci": "Fibonacci",
    "Modified Fibonacci": "Modifizierte Fibonacci",
    "T-shirt sizes": "T-Shirt-Größen",
    "Powers of 2": "Zweierpotenzen",
    "Custom": "Eigenes"
```

- [ ] **Step 12: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Unit/Poker/PokerDeckTest.php tests/Feature/Poker/PokerModelTest.php tests/Feature/UuidPrimaryKeysTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 13: Format and analyse**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress`
Expected: phpstan `[OK] No errors`.

- [ ] **Step 14: Commit**

```bash
git add database/migrations/2026_10_03_100000_create_poker_tables.php app/Enums/PokerDeck.php app/Enums/PokerRevealReason.php app/Models/PokerGame.php app/Models/PokerPlayer.php app/Models/PokerTask.php app/Models/PokerRound.php app/Models/PokerVote.php app/Models/Team.php database/factories/PokerGameFactory.php database/factories/PokerPlayerFactory.php database/factories/PokerTaskFactory.php database/factories/PokerRoundFactory.php database/factories/PokerVoteFactory.php tests/Pest.php tests/Unit/Poker/PokerDeckTest.php tests/Feature/Poker/PokerModelTest.php lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat: add the planning poker schema, decks and models

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

### Task 3: Results and Markdown (`PokerResult`, `RenderTaskMarkdown`)

**Files:**
- Create: `app/Actions/Poker/PokerResult.php`, `app/Actions/Poker/RenderTaskMarkdown.php`, `app/Actions/Poker/ImageAsLinkRenderer.php`
- Test: create `tests/Unit/Poker/PokerResultTest.php`, `tests/Feature/Poker/MarkdownTest.php`

**Interfaces:**
- Consumes: `PokerDeck` (Task 2), `PokerRound` with `votes` loaded, `PokerGame::cards`.
- Produces:
  - `PokerResult::compute(array $deckCards, array $values): array{average: ?float, distribution: array<int, array{value: string, count: int}>, mode: array<int, string>, consensus: bool, nearestCard: ?string}` — pure; `distribution` in deck order, played values only (special cards included); countable = non-special; numeric deck → `average` = mean of countable values rounded half-up to 1 decimal, `nearestCard` = numeric card closest to the **rounded** average, ties → the higher card; non-numeric deck → `average: null`, `nearestCard: null`; `mode` = most-played countable value(s) in deck order, for every deck; `consensus` = at least one countable vote and all countable votes equal; no countable vote → `average: null, mode: [], consensus: false, nearestCard: null`.
  - `PokerResult::for(PokerRound $round, PokerGame $game): array` (same shape, from `$round->votes`).
  - `RenderTaskMarkdown::handle(?string $markdown): string` — `''` for null/blank; `Str::markdown()` with `html_input: escape`, `allow_unsafe_links: false`, the core `ExternalLinkExtension` (`rel="nofollow noopener noreferrer"`, `target="_blank"` on external links) and `ImageAsLinkRenderer`.
  - `ImageAsLinkRenderer implements NodeRendererInterface, ExtensionInterface` — registers itself for `Image` nodes (priority 10, above the core renderer); renders `<a href="{url}" rel="nofollow noopener noreferrer" target="_blank">{alt}</a>` for `http(s)` URLs, the alt text alone for anything else. Never an `<img>`.
- Tests required (unit): averages for Fibonacci, Modified Fibonacci with `½`, Powers of 2; `?`/`☕` excluded; rounding (`[1, 2, 2]` → 1.7); nearest card tie → higher (`[1, 2]` → 1.5 → `2`); T-shirt → no average, mode with ties in deck order; consensus; all-special votes; custom numeric deck; distribution order. (feature) "escapes raw html", "drops javascript links", "renders images as links", "marks external links".

- [ ] **Step 1: Write the failing unit test**

Create `tests/Unit/Poker/PokerResultTest.php`:

```php
<?php

use App\Actions\Poker\PokerResult;
use App\Enums\PokerDeck;

it('averages a Fibonacci round and picks the nearest card', function () {
    $result = PokerResult::compute(PokerDeck::Fibonacci->cards(), ['3', '5', '8', '5']);

    expect($result['average'])->toBe(5.3)
        ->and($result['nearestCard'])->toBe('5')
        ->and($result['mode'])->toBe(['5'])
        ->and($result['consensus'])->toBeFalse();
});

it('counts ½ in Modified Fibonacci', function () {
    $result = PokerResult::compute(PokerDeck::ModifiedFibonacci->cards(), ['½', '1']);

    expect($result['average'])->toBe(0.8)
        ->and($result['nearestCard'])->toBe('1');
});

it('averages powers of two', function () {
    $result = PokerResult::compute(PokerDeck::PowersOfTwo->cards(), ['2', '4', '8']);

    expect($result['average'])->toBe(4.7)
        ->and($result['nearestCard'])->toBe('4');
});

it('leaves ? and ☕ out of the numbers but in the distribution', function () {
    $result = PokerResult::compute(PokerDeck::Fibonacci->cards(), ['☕', '8', '?', '8']);

    expect($result['average'])->toBe(8.0)
        ->and($result['consensus'])->toBeTrue()
        ->and($result['mode'])->toBe(['8'])
        ->and($result['distribution'])->toBe([
            ['value' => '8', 'count' => 2],
            ['value' => '?', 'count' => 1],
            ['value' => '☕', 'count' => 1],
        ]);
});

it('rounds the average half up to one decimal', function () {
    expect(PokerResult::compute(PokerDeck::Fibonacci->cards(), ['1', '2', '2'])['average'])->toBe(1.7)
        ->and(PokerResult::compute(PokerDeck::Fibonacci->cards(), ['1', '2', '2', '2'])['average'])->toBe(1.8);
});

it('breaks a nearest-card tie towards the higher card', function () {
    $result = PokerResult::compute(PokerDeck::Fibonacci->cards(), ['1', '2']);

    expect($result['average'])->toBe(1.5)
        ->and($result['nearestCard'])->toBe('2')
        ->and($result['mode'])->toBe(['1', '2']);
});

it('gives the mode and no average for T-shirt decks', function () {
    $result = PokerResult::compute(PokerDeck::Tshirt->cards(), ['M', 'S', 'M', 'S', 'L']);

    expect($result['average'])->toBeNull()
        ->and($result['nearestCard'])->toBeNull()
        ->and($result['mode'])->toBe(['S', 'M'])
        ->and($result['consensus'])->toBeFalse();
});

it('reports consensus when every countable vote agrees', function () {
    $result = PokerResult::compute(PokerDeck::Tshirt->cards(), ['L', 'L', '?']);

    expect($result['consensus'])->toBeTrue()
        ->and($result['mode'])->toBe(['L']);
});

it('has no result numbers when every vote is special', function () {
    $result = PokerResult::compute(PokerDeck::Fibonacci->cards(), ['?', '☕']);

    expect($result)->toBe([
        'average' => null,
        'distribution' => [
            ['value' => '?', 'count' => 1],
            ['value' => '☕', 'count' => 1],
        ],
        'mode' => [],
        'consensus' => false,
        'nearestCard' => null,
    ]);
});

it('treats custom decks as numeric only when every card is a number', function () {
    $numeric = PokerResult::compute(['1', '3', '5', '?'], ['1', '5']);
    $words = PokerResult::compute(['small', 'big', '?'], ['big', 'small', 'big']);

    expect($numeric['average'])->toBe(3.0)
        ->and($numeric['nearestCard'])->toBe('3')
        ->and($words['average'])->toBeNull()
        ->and($words['mode'])->toBe(['big']);
});

it('orders the distribution like the deck', function () {
    $result = PokerResult::compute(PokerDeck::Fibonacci->cards(), ['13', '1', '5', '1']);

    expect(array_column($result['distribution'], 'value'))->toBe(['1', '5', '13'])
        ->and(array_column($result['distribution'], 'count'))->toBe([2, 1, 1]);
});
```

Check: `['3','5','8','5']` → 21 / 4 = 5.25 → 5.3; nearest to 5.3 is `5`.

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Unit/Poker/PokerResultTest.php`
Expected: FAIL — `Class "App\Actions\Poker\PokerResult" not found`.

- [ ] **Step 3: Implement `PokerResult`**

Create `app/Actions/Poker/PokerResult.php`:

```php
<?php

namespace App\Actions\Poker;

use App\Enums\PokerDeck;
use App\Models\PokerGame;
use App\Models\PokerRound;
use App\Models\PokerVote;

class PokerResult
{
    private const Epsilon = 1e-9;

    /**
     * @return array{
     *     average: ?float,
     *     distribution: array<int, array{value: string, count: int}>,
     *     mode: array<int, string>,
     *     consensus: bool,
     *     nearestCard: ?string
     * }
     */
    public static function for(PokerRound $round, PokerGame $game): array
    {
        return self::compute($game->cards, $round->votes->map(fn (PokerVote $vote): string => $vote->value)->all());
    }

    /**
     * @param  array<int, string>  $deckCards
     * @param  array<int, string>  $values
     * @return array{
     *     average: ?float,
     *     distribution: array<int, array{value: string, count: int}>,
     *     mode: array<int, string>,
     *     consensus: bool,
     *     nearestCard: ?string
     * }
     */
    public static function compute(array $deckCards, array $values): array
    {
        $distribution = self::distribution($deckCards, $values);
        $countable = array_values(array_filter($distribution, fn (array $entry): bool => ! PokerDeck::isSpecial($entry['value'])));

        if ($countable === []) {
            return [
                'average' => null,
                'distribution' => $distribution,
                'mode' => [],
                'consensus' => false,
                'nearestCard' => null,
            ];
        }

        $average = PokerDeck::isNumericDeck($deckCards) ? self::average($countable) : null;

        return [
            'average' => $average,
            'distribution' => $distribution,
            'mode' => self::mode($countable),
            'consensus' => count($countable) === 1,
            'nearestCard' => $average === null ? null : self::nearestCard($deckCards, $average),
        ];
    }

    /**
     * @param  array<int, string>  $deckCards
     * @param  array<int, string>  $values
     * @return array<int, array{value: string, count: int}>
     */
    private static function distribution(array $deckCards, array $values): array
    {
        $distribution = [];

        foreach ($deckCards as $card) {
            $count = count(array_filter($values, fn (string $value): bool => $value === $card));

            if ($count === 0) {
                continue;
            }

            $distribution[] = ['value' => $card, 'count' => $count];
        }

        return $distribution;
    }

    /**
     * @param  array<int, array{value: string, count: int}>  $countable
     */
    private static function average(array $countable): float
    {
        $sum = 0.0;
        $votes = 0;

        foreach ($countable as $entry) {
            $sum += (float) PokerDeck::numericValue($entry['value']) * $entry['count'];
            $votes += $entry['count'];
        }

        return round($sum / $votes, 1);
    }

    /**
     * @param  array<int, array{value: string, count: int}>  $countable
     * @return array<int, string>
     */
    private static function mode(array $countable): array
    {
        $highest = max(array_column($countable, 'count'));

        return array_values(array_map(
            fn (array $entry): string => $entry['value'],
            array_filter($countable, fn (array $entry): bool => $entry['count'] === $highest),
        ));
    }

    /**
     * @param  array<int, string>  $deckCards
     */
    private static function nearestCard(array $deckCards, float $average): ?string
    {
        $nearest = null;
        $nearestValue = 0.0;
        $nearestDistance = INF;

        foreach ($deckCards as $card) {
            $value = PokerDeck::numericValue($card);

            if ($value === null) {
                continue;
            }

            $distance = abs($value - $average);
            $isCloser = $distance < $nearestDistance - self::Epsilon;
            $isHigherTie = abs($distance - $nearestDistance) <= self::Epsilon && $value > $nearestValue;

            if (! $isCloser && ! $isHigherTie) {
                continue;
            }

            $nearest = $card;
            $nearestValue = $value;
            $nearestDistance = $distance;
        }

        return $nearest;
    }
}
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `vendor/bin/sail artisan test --compact tests/Unit/Poker/PokerResultTest.php`
Expected: PASS.

- [ ] **Step 5: Write the failing Markdown test**

Create `tests/Feature/Poker/MarkdownTest.php`:

```php
<?php

use App\Actions\Poker\RenderTaskMarkdown;

function renderTaskMarkdown(?string $markdown): string
{
    return app(RenderTaskMarkdown::class)->handle($markdown);
}

it('renders nothing for an empty description', function () {
    expect(renderTaskMarkdown(null))->toBe('')
        ->and(renderTaskMarkdown('   '))->toBe('');
});

it('escapes raw html', function () {
    $html = renderTaskMarkdown("Intro\n\n<script>alert(1)</script>\n\n<b onclick=\"x()\">bold</b>");

    expect($html)->not->toContain('<script')
        ->and($html)->not->toContain('<b onclick')
        ->and($html)->toContain('&lt;script&gt;');
});

it('drops javascript links', function () {
    $html = renderTaskMarkdown('[click](javascript:alert(1)) and <javascript:alert(2)>');

    expect($html)->not->toContain('javascript:alert(1)"')
        ->and($html)->not->toContain('href="javascript:')
        ->and($html)->toContain('click');
});

it('renders images as links', function () {
    $html = renderTaskMarkdown('![diagram](https://example.com/a.png) ![bad](javascript:alert(1)) ![inline](data:image/png;base64,AAAA)');

    expect($html)->not->toContain('<img')
        ->and($html)->toContain('<a href="https://example.com/a.png" rel="nofollow noopener noreferrer" target="_blank">diagram</a>')
        ->and($html)->toContain('bad')
        ->and($html)->not->toContain('href="javascript:')
        ->and($html)->not->toContain('href="data:');
});

it('marks external links', function () {
    $html = renderTaskMarkdown('See [the docs](https://docs.example.com/page).');

    expect($html)->toContain('href="https://docs.example.com/page"')
        ->and($html)->toContain('rel="nofollow noopener noreferrer"')
        ->and($html)->toContain('target="_blank"');
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/MarkdownTest.php`
Expected: FAIL — `Target class [App\Actions\Poker\RenderTaskMarkdown] does not exist`.

- [ ] **Step 7: Implement the renderer and the action**

Create `app/Actions/Poker/ImageAsLinkRenderer.php`:

```php
<?php

namespace App\Actions\Poker;

use League\CommonMark\Environment\EnvironmentBuilderInterface;
use League\CommonMark\Extension\CommonMark\Node\Inline\Image;
use League\CommonMark\Extension\ExtensionInterface;
use League\CommonMark\Node\Node;
use League\CommonMark\Renderer\ChildNodeRendererInterface;
use League\CommonMark\Renderer\NodeRendererInterface;
use League\CommonMark\Util\HtmlElement;

/**
 * An <img> would make every viewer's browser contact the image host, so
 * images become plain links to the image, labelled with the alt text.
 */
class ImageAsLinkRenderer implements ExtensionInterface, NodeRendererInterface
{
    public function register(EnvironmentBuilderInterface $environment): void
    {
        $environment->addRenderer(Image::class, $this, 10);
    }

    public function render(Node $node, ChildNodeRendererInterface $childRenderer): \Stringable|string
    {
        Image::assertInstanceOf($node);

        $alt = $childRenderer->renderNodes($node->children());
        $url = trim($node->getUrl());

        if (preg_match('#^https?://#i', $url) !== 1) {
            return $alt;
        }

        return new HtmlElement('a', [
            'href' => $url,
            'rel' => 'nofollow noopener noreferrer',
            'target' => '_blank',
        ], $alt === '' ? $url : $alt);
    }
}
```

Note: `HtmlElement` escapes attribute values; the alt text comes from the child renderer, which escapes text nodes.

Create `app/Actions/Poker/RenderTaskMarkdown.php`:

```php
<?php

namespace App\Actions\Poker;

use Illuminate\Support\Str;
use League\CommonMark\Extension\ExternalLink\ExternalLinkExtension;

class RenderTaskMarkdown
{
    public function handle(?string $markdown): string
    {
        if ($markdown === null || trim($markdown) === '') {
            return '';
        }

        return trim(Str::markdown($markdown, [
            'html_input' => 'escape',
            'allow_unsafe_links' => false,
            'external_link' => [
                'internal_hosts' => [parse_url((string) config('app.url'), PHP_URL_HOST) ?: 'localhost'],
                'open_in_new_window' => true,
                'nofollow' => 'external',
                'noopener' => 'external',
                'noreferrer' => 'external',
            ],
        ], [new ExternalLinkExtension, new ImageAsLinkRenderer]));
    }
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Unit/Poker/PokerResultTest.php tests/Feature/Poker/MarkdownTest.php`
Expected: PASS. If "drops javascript links" fails on the autolink `<javascript:alert(2)>` (CommonMark keeps it as text or renders the link without `href` when unsafe links are disallowed — both pass the assertions), inspect the output with `dump($html)` before changing the assertion, never the options.

- [ ] **Step 9: Format and analyse**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress`
Expected: phpstan `[OK] No errors`. If phpstan objects to the `\Stringable|string` return type against `NodeRendererInterface::render(): \Stringable|string|null`, keep the narrower union (covariant) — it is valid.

- [ ] **Step 10: Commit**

```bash
git add app/Actions/Poker/PokerResult.php app/Actions/Poker/RenderTaskMarkdown.php app/Actions/Poker/ImageAsLinkRenderer.php tests/Unit/Poker/PokerResultTest.php tests/Feature/Poker/MarkdownTest.php
git commit -m "feat: compute poker results and render task markdown safely

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

#### Implementer notes

- The outline puts the image renderer in `app/Actions/Poker/ImageAsLinkRenderer.php` as a `NodeRendererInterface`; `Str::markdown()` only accepts extensions, so the class also implements `ExtensionInterface` and registers itself (no second file). `Str::markdown()` is used as the outline prefers.
- Images are turned into links only for `http(s)` URLs; `data:` URLs (which CommonMark treats as safe for images) render as their alt text, so a description cannot embed content either.

### Task 4: Presenting and events (`PresentPokerRound`, `PresentPokerTask`, `BuildPokerSnapshot`, `PokerBroadcastEvent`)

**Files:**
- Create: `app/Actions/Poker/{PresentPokerRound,PresentPokerTask,BuildPokerSnapshot}.php`, `app/Events/Poker/{PokerBroadcastEvent,PokerTaskSaved,PokerTaskDeleted,PokerTasksReordered,PokerVoteChanged,PokerRoundChanged,PokerGameChanged,PokerGameDeleted,PokerTaskEstimated}.php`
- Test: create `tests/Feature/Poker/PokerSnapshotTest.php`, `tests/Feature/Poker/PokerEventsTest.php`

**Interfaces:**
- Consumes: Tasks 2–3 (`PokerGame::{isFacilitator, isNumeric, deckLabel, hasVotes, latestRoundOfCurrentTask}`, `PokerResult::for`, `RenderTaskMarkdown`), `App\Events\Concerns\SendsToOthers`, `WorkspaceRole`.
- Produces:
  - `PresentPokerRound::handle(PokerRound $round, PokerGame $game, ?string $viewerPlayerId, bool $listUnrevealedVoters = true): array{id: string, number: int, anonymous: bool, revealedAt: ?string, revealReason: ?string, timerEndsAt: ?string, version: int, votesCount: int, votes: array<int, array{playerId: string, value: ?string}>, myVote: ?string, result: ?array}` — uses `$round->votes` and `$game->players` (loaded by the caller; lazily loaded otherwise); voters in player join order; `value` only when the round is revealed or the vote is the viewer's; unrevealed + `$listUnrevealedVoters = false` → `votes: []`; `result` only when revealed. The **only** place that serializes a vote value.
  - `PresentPokerTask::handle(PokerTask $task): array{id: string, title: string, description: ?string, descriptionHtml: string, position: int, estimate: ?string, estimatedAt: ?string, roundsCount: int, external: null}`.
  - `BuildPokerSnapshot::handle(PokerGame $game, PokerPlayer $viewer): array` — spec §6 shape (as amended): `game` (incl. `hasVotes`), `me` (incl. `userId`, `transferCandidates`), `players`, `tasks`, `current`, `links.team`, `serverTime`; constant number of queries.
  - `abstract PokerBroadcastEvent` and the seven broadcast events (`task.saved` `{task}`, `task.deleted` `{taskId}`, `tasks.reordered` `{taskIds}`, `vote.changed` `{roundId, playerId, hasVoted, votesCount, version}`, `round.changed` `{}`, `game.changed` `{}`, `game.deleted` `{}`), plain event `PokerTaskEstimated(PokerTask $task)`.
- Tests required: "hides other players' values before reveal, for the facilitator too", "shows every value after reveal", "lists no voters in the history mode of an unrevealed round", "orders voters by join order", "gives guests no guest url, team link or transfer candidates", "computes counts and total points", "builds the snapshot with a constant number of queries", events: "broadcasts on the poker presence channel", "never puts a card value in a broadcast payload".

- [ ] **Step 1: Write the failing events test**

Create `tests/Feature/Poker/PokerEventsTest.php`:

```php
<?php

use App\Actions\Poker\PresentPokerTask;
use App\Events\Poker\PokerBroadcastEvent;
use App\Events\Poker\PokerGameChanged;
use App\Events\Poker\PokerGameDeleted;
use App\Events\Poker\PokerRoundChanged;
use App\Events\Poker\PokerTaskDeleted;
use App\Events\Poker\PokerTaskEstimated;
use App\Events\Poker\PokerTaskSaved;
use App\Events\Poker\PokerTasksReordered;
use App\Events\Poker\PokerVoteChanged;
use App\Models\PokerGame;
use App\Models\PokerTask;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;

it('broadcasts on the poker presence channel', function () {
    $event = new PokerRoundChanged('game-id');

    expect($event)->toBeInstanceOf(ShouldBroadcastNow::class)
        ->and($event)->toBeInstanceOf(ShouldDispatchAfterCommit::class)
        ->and($event->broadcastOn())->toBeInstanceOf(PresenceChannel::class)
        ->and($event->broadcastOn()->name)->toBe('presence-poker.game-id');
});

it('never puts a card value in a broadcast payload', function (PokerBroadcastEvent $event, string $name, array $keys) {
    expect($event->broadcastAs())->toBe($name)
        ->and(array_keys($event->broadcastWith()))->toBe($keys);
})->with([
    'task saved' => [fn () => new PokerTaskSaved('g', ['id' => 't']), 'task.saved', ['task']],
    'task deleted' => [fn () => new PokerTaskDeleted('g', 't'), 'task.deleted', ['taskId']],
    'tasks reordered' => [fn () => new PokerTasksReordered('g', ['a', 'b']), 'tasks.reordered', ['taskIds']],
    'vote changed' => [fn () => new PokerVoteChanged('g', 'r', 'p', true, 2, 3), 'vote.changed', ['roundId', 'playerId', 'hasVoted', 'votesCount', 'version']],
    'round changed' => [fn () => new PokerRoundChanged('g'), 'round.changed', []],
    'game changed' => [fn () => new PokerGameChanged('g'), 'game.changed', []],
    'game deleted' => [fn () => new PokerGameDeleted('g'), 'game.deleted', []],
]);

it('keeps votes out of task payloads', function () {
    $game = PokerGame::factory()->create();
    [, $player] = pokerMember($game);
    $round = openPokerRound($game);
    pokerVote($round, $player, '13');

    $payload = app(PresentPokerTask::class)->handle($round->task->fresh());

    expect(array_keys($payload))->toBe(['id', 'title', 'description', 'descriptionHtml', 'position', 'estimate', 'estimatedAt', 'roundsCount', 'external'])
        ->and($payload['roundsCount'])->toBe(1)
        ->and($payload['external'])->toBeNull();
});

it('dispatches the estimate event after commit', function () {
    $task = PokerTask::factory()->create();

    expect(new PokerTaskEstimated($task))->toBeInstanceOf(ShouldDispatchAfterCommit::class)
        ->and((new PokerTaskEstimated($task))->task->is($task))->toBeTrue();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerEventsTest.php`
Expected: FAIL — `Class "App\Events\Poker\PokerRoundChanged" not found`.

- [ ] **Step 3: Create the events**

Create `app/Events/Poker/PokerBroadcastEvent.php`:

```php
<?php

namespace App\Events\Poker;

use App\Events\Concerns\SendsToOthers;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Card values never travel in a broadcast: reveals and selections are
 * announced as changes, and each client refetches its own snapshot.
 */
abstract class PokerBroadcastEvent implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable;
    use InteractsWithSockets;
    use SendsToOthers;

    public function __construct(public string $gameId) {}

    public function broadcastOn(): Channel
    {
        return new PresenceChannel("poker.{$this->gameId}");
    }

    abstract public function broadcastAs(): string;

    /**
     * @return array<string, mixed>
     */
    abstract public function broadcastWith(): array;
}
```

Create `app/Events/Poker/PokerTaskSaved.php`:

```php
<?php

namespace App\Events\Poker;

class PokerTaskSaved extends PokerBroadcastEvent
{
    /**
     * @param  array<string, mixed>  $task
     */
    public function __construct(string $gameId, public array $task)
    {
        parent::__construct($gameId);
    }

    public function broadcastAs(): string
    {
        return 'task.saved';
    }

    public function broadcastWith(): array
    {
        return ['task' => $this->task];
    }
}
```

Create `app/Events/Poker/PokerTaskDeleted.php`:

```php
<?php

namespace App\Events\Poker;

class PokerTaskDeleted extends PokerBroadcastEvent
{
    public function __construct(string $gameId, public string $taskId)
    {
        parent::__construct($gameId);
    }

    public function broadcastAs(): string
    {
        return 'task.deleted';
    }

    public function broadcastWith(): array
    {
        return ['taskId' => $this->taskId];
    }
}
```

Create `app/Events/Poker/PokerTasksReordered.php`:

```php
<?php

namespace App\Events\Poker;

class PokerTasksReordered extends PokerBroadcastEvent
{
    /**
     * @param  array<int, string>  $taskIds
     */
    public function __construct(string $gameId, public array $taskIds)
    {
        parent::__construct($gameId);
    }

    public function broadcastAs(): string
    {
        return 'tasks.reordered';
    }

    public function broadcastWith(): array
    {
        return ['taskIds' => $this->taskIds];
    }
}
```

Create `app/Events/Poker/PokerVoteChanged.php`:

```php
<?php

namespace App\Events\Poker;

class PokerVoteChanged extends PokerBroadcastEvent
{
    public function __construct(
        string $gameId,
        public string $roundId,
        public string $playerId,
        public bool $hasVoted,
        public int $votesCount,
        public int $version,
    ) {
        parent::__construct($gameId);
    }

    public function broadcastAs(): string
    {
        return 'vote.changed';
    }

    public function broadcastWith(): array
    {
        return [
            'roundId' => $this->roundId,
            'playerId' => $this->playerId,
            'hasVoted' => $this->hasVoted,
            'votesCount' => $this->votesCount,
            'version' => $this->version,
        ];
    }
}
```

Create `app/Events/Poker/PokerRoundChanged.php`:

```php
<?php

namespace App\Events\Poker;

class PokerRoundChanged extends PokerBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'round.changed';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
```

Create `app/Events/Poker/PokerGameChanged.php`:

```php
<?php

namespace App\Events\Poker;

class PokerGameChanged extends PokerBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'game.changed';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
```

Create `app/Events/Poker/PokerGameDeleted.php`:

```php
<?php

namespace App\Events\Poker;

class PokerGameDeleted extends PokerBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'game.deleted';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
```

Create `app/Events/Poker/PokerTaskEstimated.php`:

```php
<?php

namespace App\Events\Poker;

use App\Models\PokerTask;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Domain event for integrations (spec 6 write-back, spec 8 webhooks); no
 * listener in this spec.
 */
class PokerTaskEstimated implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(public PokerTask $task) {}
}
```

- [ ] **Step 4: Create `PresentPokerTask` and `PresentPokerRound`**

Create `app/Actions/Poker/PresentPokerTask.php`:

```php
<?php

namespace App\Actions\Poker;

use App\Models\PokerTask;

class PresentPokerTask
{
    public function __construct(private RenderTaskMarkdown $renderTaskMarkdown) {}

    /**
     * External references stay null until the tracker imports of spec 6.
     *
     * @return array{
     *     id: string,
     *     title: string,
     *     description: ?string,
     *     descriptionHtml: string,
     *     position: int,
     *     estimate: ?string,
     *     estimatedAt: ?string,
     *     roundsCount: int,
     *     external: null
     * }
     */
    public function handle(PokerTask $task): array
    {
        $roundsCount = $task->getAttribute('rounds_count');

        return [
            'id' => $task->id,
            'title' => $task->title,
            'description' => $task->description,
            'descriptionHtml' => $this->renderTaskMarkdown->handle($task->description),
            'position' => $task->position,
            'estimate' => $task->estimate,
            'estimatedAt' => $task->estimated_at?->toIso8601String(),
            'roundsCount' => $roundsCount === null ? $task->rounds()->count() : (int) $roundsCount,
            'external' => null,
        ];
    }
}
```

Create `app/Actions/Poker/PresentPokerRound.php`:

```php
<?php

namespace App\Actions\Poker;

use App\Models\PokerGame;
use App\Models\PokerRound;
use App\Models\PokerVote;

/**
 * The only place that turns votes into payloads: before reveal a player
 * sees their own value only, whoever they are (facilitator included).
 */
class PresentPokerRound
{
    /**
     * @return array{
     *     id: string,
     *     number: int,
     *     anonymous: bool,
     *     revealedAt: ?string,
     *     revealReason: ?string,
     *     timerEndsAt: ?string,
     *     version: int,
     *     votesCount: int,
     *     votes: array<int, array{playerId: string, value: ?string}>,
     *     myVote: ?string,
     *     result: ?array{
     *         average: ?float,
     *         distribution: array<int, array{value: string, count: int}>,
     *         mode: array<int, string>,
     *         consensus: bool,
     *         nearestCard: ?string
     *     }
     * }
     */
    public function handle(PokerRound $round, PokerGame $game, ?string $viewerPlayerId, bool $listUnrevealedVoters = true): array
    {
        $isRevealed = $round->isRevealed();
        $joinOrder = $game->players->pluck('id')->flip();
        $votes = $round->votes
            ->sortBy(fn (PokerVote $vote): int => (int) ($joinOrder[$vote->poker_player_id] ?? PHP_INT_MAX))
            ->values();
        $myVote = $viewerPlayerId === null ? null : $votes->firstWhere('poker_player_id', $viewerPlayerId);
        $listsVoters = $isRevealed || $listUnrevealedVoters;

        return [
            'id' => $round->id,
            'number' => $round->number,
            'anonymous' => $round->anonymous,
            'revealedAt' => $round->revealed_at?->toIso8601String(),
            'revealReason' => $round->reveal_reason?->value,
            'timerEndsAt' => $round->timer_ends_at?->toIso8601String(),
            'version' => $round->version,
            'votesCount' => $votes->count(),
            'votes' => $listsVoters
                ? $votes->map(fn (PokerVote $vote): array => [
                    'playerId' => $vote->poker_player_id,
                    'value' => $isRevealed || $vote->poker_player_id === $viewerPlayerId ? $vote->value : null,
                ])->all()
                : [],
            'myVote' => $myVote?->value,
            'result' => $isRevealed ? PokerResult::for($round, $game) : null,
        ];
    }
}
```

- [ ] **Step 5: Run the events test to verify it passes**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerEventsTest.php`
Expected: PASS.

- [ ] **Step 6: Write the failing snapshot test**

Create `tests/Feature/Poker/PokerSnapshotTest.php`:

```php
<?php

use App\Actions\Poker\BuildPokerSnapshot;
use App\Actions\Poker\PresentPokerRound;
use App\Enums\PokerDeck;
use App\Enums\PokerRevealReason;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use Illuminate\Support\Facades\DB;

/**
 * @return array<string, mixed>
 */
function pokerSnapshot(PokerGame $game, PokerPlayer $viewer): array
{
    return app(BuildPokerSnapshot::class)->handle($game->fresh(), $viewer->fresh());
}

/**
 * @param  array<int, array{playerId: string, value: ?string}>  $votes
 * @return array<string, ?string>
 */
function pokerVotesByPlayer(array $votes): array
{
    return collect($votes)->pluck('value', 'playerId')->all();
}

it("hides other players' values before reveal, for the facilitator too", function () {
    $game = PokerGame::factory()->create();
    [, $facilitator] = pokerFacilitator($game);
    [$memberUser, $member] = pokerMember($game);
    $round = openPokerRound($game);
    pokerVote($round, $facilitator, '5');
    pokerVote($round, $member, '8');

    $forFacilitator = pokerSnapshot($game, $facilitator);
    $forMember = pokerSnapshot($game, $member);

    expect(pokerVotesByPlayer($forFacilitator['current']['round']['votes']))->toEqual([
        $facilitator->id => '5',
        $member->id => null,
    ])
        ->and($forFacilitator['current']['round']['myVote'])->toBe('5')
        ->and($forFacilitator['current']['round']['votesCount'])->toBe(2)
        ->and($forFacilitator['current']['round']['result'])->toBeNull()
        ->and($forFacilitator['current']['taskId'])->toBe($round->poker_task_id)
        ->and($forFacilitator['me']['isFacilitator'])->toBeTrue()
        ->and(collect($forFacilitator['me']['transferCandidates'])->pluck('userId')->all())->toContain($memberUser->id)
        ->and(pokerVotesByPlayer($forMember['current']['round']['votes']))->toEqual([
            $facilitator->id => null,
            $member->id => '8',
        ])
        ->and($forMember['current']['round']['myVote'])->toBe('8')
        ->and($forMember['me']['transferCandidates'])->toBe([]);
});

it('shows every value after reveal', function () {
    $game = PokerGame::factory()->create();
    [, $facilitator] = pokerFacilitator($game);
    [, $member] = pokerMember($game);
    $round = openPokerRound($game);
    pokerVote($round, $facilitator, '5');
    pokerVote($round, $member, '8');
    $round->update(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual]);

    $snapshot = pokerSnapshot($game, $member);

    expect(pokerVotesByPlayer($snapshot['current']['round']['votes']))->toEqual([
        $facilitator->id => '5',
        $member->id => '8',
    ])
        ->and($snapshot['current']['round']['revealReason'])->toBe('manual')
        ->and($snapshot['current']['round']['result']['average'])->toBe(6.5)
        ->and($snapshot['current']['round']['result']['nearestCard'])->toBe('8')
        ->and($snapshot['game']['hasVotes'])->toBeTrue();
});

it('lists no voters in the history mode of an unrevealed round', function () {
    $game = PokerGame::factory()->create();
    [, $facilitator] = pokerFacilitator($game);
    [, $member] = pokerMember($game);
    $round = openPokerRound($game);
    pokerVote($round, $facilitator, '5');
    pokerVote($round, $member, '8');

    $presented = app(PresentPokerRound::class)->handle($round->fresh(['votes']), $game->fresh(), $member->id, listUnrevealedVoters: false);

    expect($presented['votes'])->toBe([])
        ->and($presented['votesCount'])->toBe(2)
        ->and($presented['myVote'])->toBe('8')
        ->and($presented['result'])->toBeNull();
});

it('orders voters by join order', function () {
    $game = PokerGame::factory()->create();
    [, $first] = pokerFacilitator($game);
    $this->travel(1)->seconds();
    [, $second] = pokerMember($game);
    $this->travel(1)->seconds();
    $third = pokerGuest($game);
    $round = openPokerRound($game);
    pokerVote($round, $third, '1');
    pokerVote($round, $second, '2');
    pokerVote($round, $first, '3');
    $round->update(['revealed_at' => now()]);

    $snapshot = pokerSnapshot($game, $first);

    expect(array_column($snapshot['current']['round']['votes'], 'playerId'))->toBe([$first->id, $second->id, $third->id])
        ->and(array_column($snapshot['players'], 'id'))->toBe([$first->id, $second->id, $third->id]);
});

it('gives guests no guest url, team link or transfer candidates', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    pokerFacilitator($game);
    $guest = pokerGuest($game);

    $snapshot = pokerSnapshot($game, $guest);

    expect($snapshot['game']['guestUrl'])->toBeNull()
        ->and($snapshot['links']['team'])->toBeNull()
        ->and($snapshot['me'])->toMatchArray([
            'playerId' => $guest->id,
            'userId' => null,
            'isGuest' => true,
            'isFacilitator' => false,
            'canVote' => true,
            'canEditTasks' => false,
            'canTakeControl' => false,
            'canDelete' => false,
            'transferCandidates' => [],
        ])
        ->and(collect($snapshot['players'])->firstWhere('id', $guest->id))->toMatchArray([
            'name' => $guest->guest_name,
            'isGuest' => true,
            'isSpectator' => false,
        ]);
});

it('describes what members and workspace admins may do', function () {
    $game = PokerGame::factory()->create();
    pokerFacilitator($game);
    [$memberUser, $member] = pokerMember($game);
    $admin = PokerPlayer::factory()->create([
        'poker_game_id' => $game->id,
        'user_id' => workspaceManager($game->team->workspace)->id,
    ]);

    $forMember = pokerSnapshot($game, $member);
    $forAdmin = pokerSnapshot($game, $admin);

    expect($forMember['me'])->toMatchArray([
        'userId' => $memberUser->id,
        'canEditTasks' => true,
        'canTakeControl' => true,
        'canDelete' => false,
    ])
        ->and($forMember['links']['team'])->toBe(route('teams.show', [$game->team->workspace, $game->team]))
        ->and($forMember['game']['guestUrl'])->toBeNull()
        ->and($forMember['serverTime'])->toMatch('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/')
        ->and($forAdmin['me']['canDelete'])->toBeTrue();

    $game->update(['ended_at' => now()]);

    expect(pokerSnapshot($game, $member)['me']['canTakeControl'])->toBeTrue();
});

it('computes counts and total points', function () {
    $game = PokerGame::factory()->create();
    [, $facilitator] = pokerFacilitator($game);
    PokerTask::factory()->estimated('5')->create(['poker_game_id' => $game->id]);
    PokerTask::factory()->estimated('8')->create(['poker_game_id' => $game->id]);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'description' => '**Bold**']);

    $tshirt = PokerGame::factory()->deck(PokerDeck::Tshirt)->create();
    [, $tshirtFacilitator] = pokerFacilitator($tshirt);
    PokerTask::factory()->estimated('M')->create(['poker_game_id' => $tshirt->id]);

    $snapshot = pokerSnapshot($game, $facilitator);
    $tshirtSnapshot = pokerSnapshot($tshirt, $tshirtFacilitator);

    expect($snapshot['game'])->toMatchArray([
        'deck' => 'fibonacci',
        'deckLabel' => 'Fibonacci',
        'isNumeric' => true,
        'tasksCount' => 3,
        'estimatedCount' => 2,
        'totalPoints' => 13.0,
        'hasVotes' => false,
        'currentTaskId' => null,
        'autoReveal' => false,
        'anonymousVotes' => false,
        'cursorsEnabled' => true,
        'reactionsEnabled' => true,
    ])
        ->and($snapshot['current'])->toBeNull()
        ->and(array_column($snapshot['tasks'], 'position'))->toBe([1, 2, 3])
        ->and($snapshot['tasks'][2]['descriptionHtml'])->toContain('<strong>Bold</strong>')
        ->and($tshirtSnapshot['game']['totalPoints'])->toBeNull()
        ->and($tshirtSnapshot['game']['estimatedCount'])->toBe(1)
        ->and($tshirtSnapshot['game']['isNumeric'])->toBeFalse();
});

it('builds the snapshot with a constant number of queries', function () {
    $game = PokerGame::factory()->create();
    [, $facilitator] = pokerFacilitator($game);
    $seed = function (int $tasks, int $rounds, int $players) use ($game): void {
        $voters = collect(range(1, $players))->map(fn () => pokerMember($game)[1]);

        foreach (range(1, $tasks) as $index) {
            $task = PokerTask::factory()->create(['poker_game_id' => $game->id]);

            foreach (range(1, $rounds) as $number) {
                $round = PokerRound::factory()->create(['poker_task_id' => $task->id]);
                $voters->each(fn (PokerPlayer $voter) => pokerVote($round, $voter, '3'));
            }

            $game->forceFill(['current_task_id' => $task->id])->save();
        }
    };
    $countQueries = function () use ($game, $facilitator): int {
        $fresh = $game->fresh();
        $viewer = $facilitator->fresh();

        DB::flushQueryLog();
        DB::enableQueryLog();
        app(BuildPokerSnapshot::class)->handle($fresh, $viewer);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $seed(3, 2, 2);
    $small = $countQueries();

    $seed(9, 5, 6);

    expect($countQueries())->toBe($small);
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerSnapshotTest.php`
Expected: FAIL — `Target class [App\Actions\Poker\BuildPokerSnapshot] does not exist`.

- [ ] **Step 8: Implement `BuildPokerSnapshot`**

Create `app/Actions/Poker/BuildPokerSnapshot.php`:

```php
<?php

namespace App\Actions\Poker;

use App\Enums\WorkspaceRole;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use App\Models\User;

class BuildPokerSnapshot
{
    public function __construct(
        private PresentPokerRound $presentPokerRound,
        private PresentPokerTask $presentPokerTask,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(PokerGame $game, PokerPlayer $viewer): array
    {
        $game->load([
            'team.workspace',
            'players.user',
            'tasks' => fn ($query) => $query->withCount('rounds'),
            'currentTask.latestRound.votes',
        ]);
        $viewer->loadMissing('user');

        $isGuest = $viewer->isGuest();
        $isFacilitator = $game->isFacilitator($viewer);
        $isNumeric = $game->isNumeric();
        $currentRound = $game->latestRoundOfCurrentTask();
        $team = $game->team;

        return [
            'game' => [
                'id' => $game->id,
                'title' => $game->title,
                'deck' => $game->deck->value,
                'deckLabel' => $game->deckLabel(),
                'cards' => $game->cards,
                'isNumeric' => $isNumeric,
                'facilitatorPlayerId' => $game->facilitator_player_id,
                'guestAccessEnabled' => $game->guest_access_enabled,
                'guestUrl' => ! $isGuest && $game->guest_access_enabled ? route('poker.join.show', $game->guest_token) : null,
                'endedAt' => $game->ended_at?->toIso8601String(),
                'currentTaskId' => $game->current_task_id,
                'tasksCount' => $game->tasks->count(),
                'estimatedCount' => $game->tasks->whereNotNull('estimated_at')->count(),
                'totalPoints' => $isNumeric
                    ? round((float) $game->tasks->sum(fn (PokerTask $task): float => $task->estimate_numeric ?? 0.0), 2)
                    : null,
                'hasVotes' => $game->hasVotes(),
                'autoReveal' => $game->auto_reveal,
                'anonymousVotes' => $game->anonymous_votes,
                'cursorsEnabled' => $game->cursors_enabled,
                'reactionsEnabled' => $game->reactions_enabled,
            ],
            'me' => [
                'playerId' => $viewer->id,
                'userId' => $viewer->user_id,
                'isGuest' => $isGuest,
                'isFacilitator' => $isFacilitator,
                'isSpectator' => $viewer->is_spectator,
                'canVote' => ! $viewer->is_spectator,
                'canEditTasks' => ! $isGuest,
                'canTakeControl' => ! $isGuest && ! $isFacilitator,
                'canDelete' => $isFacilitator || ($viewer->user?->canManage($team->workspace) ?? false),
                'transferCandidates' => $isFacilitator && ! $isGuest ? $this->transferCandidates($game, $viewer) : [],
            ],
            'players' => $game->players->map(fn (PokerPlayer $player): array => [
                'id' => $player->id,
                'name' => $player->displayName(),
                'avatarUrl' => $player->avatarUrl(),
                'isGuest' => $player->isGuest(),
                'isSpectator' => $player->is_spectator,
            ])->values()->all(),
            'tasks' => $game->tasks->map(fn (PokerTask $task): array => $this->presentPokerTask->handle($task))->values()->all(),
            'current' => $currentRound === null ? null : [
                'taskId' => $currentRound->poker_task_id,
                'round' => $this->presentPokerRound->handle($currentRound, $game, $viewer->id),
            ],
            'links' => [
                'team' => $isGuest ? null : route('teams.show', [$team->workspace, $team]),
            ],
            'serverTime' => now()->utc()->format('Y-m-d\TH:i:s.v\Z'),
        ];
    }

    /**
     * @return array<int, array{
     *     userId: string,
     *     name: string
     * }>
     */
    private function transferCandidates(PokerGame $game, PokerPlayer $viewer): array
    {
        $team = $game->team;

        $managerIds = $team->workspace->members()
            ->wherePivotIn('role', [WorkspaceRole::Owner->value, WorkspaceRole::Admin->value])
            ->pluck('users.id');

        return User::query()
            ->where(fn ($query) => $query
                ->whereIn('id', $team->members()->select('users.id'))
                ->orWhereIn('id', $managerIds))
            ->when($viewer->user_id !== null, fn ($query) => $query->whereKeyNot($viewer->user_id))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $user): array => ['userId' => $user->id, 'name' => $user->name])
            ->all();
    }
}
```

`guestUrl` names the route `poker.join.show`, which Task 5 registers; until then no test builds a snapshot for a non-guest viewer of a guest-enabled game (Task 5 adds that test).

- [ ] **Step 9: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerSnapshotTest.php tests/Feature/Poker/PokerEventsTest.php`
Expected: PASS. If the query-count test differs, print both logs (`dump(DB::getQueryLog())`) and remove the lazy load that grows (usually a relation missing from `load()`), never the assertion.

- [ ] **Step 10: Format and analyse**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress`
Expected: phpstan `[OK] No errors`.

- [ ] **Step 11: Commit**

```bash
git add app/Actions/Poker/PresentPokerRound.php app/Actions/Poker/PresentPokerTask.php app/Actions/Poker/BuildPokerSnapshot.php app/Events/Poker tests/Feature/Poker/PokerSnapshotTest.php tests/Feature/Poker/PokerEventsTest.php
git commit -m "feat: present poker rounds, snapshots and broadcast events

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

#### Implementer notes

- `current.taskId` is taken from the round's `poker_task_id` (same value as `current_task_id`) so the pair can never disagree.
- Voter and player order relies on `created_at` then `id` (UUIDv7 from `HasUuids`, time-ordered); tests that do not travel in time compare votes as maps (`toEqual`), only "orders voters by join order" asserts a sequence.

### Task 5: Access, joining and presence (`ResolvePlayer`, `ResolvePokerPlayer`, `PokerGuard`, join page, channel auth)

**Files:**
- Create: `app/Actions/Poker/ResolvePlayer.php`, `app/Actions/Poker/PokerGuard.php`, `app/Http/Middleware/ResolvePokerPlayer.php`, `app/Http/Controllers/PokerJoinsController.php`, `app/Http/Controllers/Poker/PokerGamesController.php` (`show` only), `app/Http/Controllers/Poker/PokerSnapshotsController.php`, `resources/js/pages/poker/join.tsx` (final), `resources/js/pages/poker/show.tsx` (placeholder, replaced in Task 14)
- Modify: `routes/web.php`, `app/Http/Controllers/BroadcastAuthorizationsController.php` (`presence-poker.` branch), `resources/js/app.tsx` (layouts), `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Poker/PokerAccessTest.php`, `tests/Feature/Poker/PokerJoinTest.php`, `tests/Feature/Poker/PokerBroadcastAuthorizationTest.php`

**Interfaces:**
- Consumes: Task 1 (`GuestCookie::{PokerScope, RetroScope, name, make, parse}`), Task 2 (`PokerGame`, `PokerPlayer`, `PokerRound`, factories, Pest helpers `pokerMember`, `pokerFacilitator`, `pokerGuest`, `pokerGuestCookie`, `PokerGame::latestRoundOfCurrentTask()`, `PokerRound::isRevealed()`), Task 4 (`BuildPokerSnapshot::handle(PokerGame, PokerPlayer)`), `PokerDeck::options()`.
- Produces:
  - `App\Actions\Poker\ResolvePlayer::handle(Request $request, PokerGame $game): ?PokerPlayer`.
  - `App\Http\Middleware\ResolvePokerPlayer` (sets request attribute `pokerPlayer`).
  - `App\Actions\Poker\PokerGuard` — static `facilitator(PokerGame, PokerPlayer)`, `notEnded(PokerGame)`, `canEditTasks(PokerPlayer)`, `canVote(PokerPlayer)`, `openRound(PokerGame, PokerRound)`, `canDelete(PokerGame, PokerPlayer)`; 403 via `AuthorizationException`, 422 via `ValidationException` (key `votes`).
  - `PokerGamesController::show` → Inertia `poker/show` with `snapshot`, `deckOptions`; `PokerSnapshotsController::show` → JSON snapshot.
  - `PokerJoinsController::show/store` (component `poker/join`, props `isInvalid`, `guestToken`, `gameTitle`, `suggestedName`).
  - Broadcast auth for `presence-poker.{uuid}` with presence data `{id, name, avatarUrl, isGuest}`.
  - Routes `poker.join.show`, `poker.join.store`, `poker.show`, `poker.snapshot.show`.

- [ ] **Step 1: Write the failing access tests**

Create `tests/Feature/Poker/PokerAccessTest.php`:

```php
<?php

use App\Actions\Retros\GuestCookie;
use App\Enums\WorkspaceRole;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('lets team members in as themselves', function () {
    $game = PokerGame::factory()->create();
    $user = teamMember($game->team);

    $this->actingAs($user)
        ->get(route('poker.show', $game))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('poker/show')
            ->where('snapshot.game.id', $game->id)
            ->where('snapshot.me.isGuest', false)
            ->has('deckOptions', 5));

    $this->actingAs($user)->getJson(route('poker.snapshot.show', $game))->assertOk();

    expect($game->players()->where('user_id', $user->id)->count())->toBe(1);
});

it('lets workspace managers open any team game', function () {
    $game = PokerGame::factory()->create();
    $admin = workspaceManager($game->team->workspace);

    $this->actingAs($admin)->get(route('poker.show', $game))->assertOk();
});

it('sends logged-out visitors to login', function () {
    $this->get(route('poker.show', PokerGame::factory()->create()))->assertRedirect(route('login'));
});

it('shows the session-ended page for guest-enabled games', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();

    $this->get(route('poker.show', $game))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('retros/session-ended'))
        ->assertSessionHas('url.intended', route('poker.show', $game));
});

it('refuses non-members with 403', function () {
    $game = PokerGame::factory()->create();
    $outsider = User::factory()->create();
    $game->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)->get(route('poker.show', $game))->assertForbidden();
    $this->actingAs($outsider)
        ->getJson(route('poker.snapshot.show', $game))
        ->assertForbidden()
        ->assertJsonPath('message', 'You no longer have access to this game.');

    expect($game->players()->count())->toBe(0);
});

it('answers logged-out json requests with 401', function () {
    $this->getJson(route('poker.snapshot.show', PokerGame::factory()->create()))
        ->assertUnauthorized()
        ->assertJsonPath('message', 'Your session has expired.');
});

it('revokes removed members and signed-out guests', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    [$user] = pokerMember($game);
    $guest = pokerGuest($game);

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->getJson(route('poker.snapshot.show', $game))
        ->assertOk();

    $guest->update(['guest_secret_hash' => null]);

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->getJson(route('poker.snapshot.show', $game))
        ->assertForbidden();

    $otherGuest = pokerGuest($game);
    $game->update(['guest_access_enabled' => false]);

    $this->withCookies(pokerGuestCookie($otherGuest))->withCredentials()
        ->getJson(route('poker.snapshot.show', $game))
        ->assertForbidden();

    $this->actingAs($user)->getJson(route('poker.snapshot.show', $game))->assertOk();

    $game->team->members()->detach($user);

    $this->actingAs($user)->getJson(route('poker.snapshot.show', $game))->assertForbidden();
});

it('keeps retro and poker guest cookies apart', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    $pokerGuest = pokerGuest($game);

    $this->withCookies([GuestCookie::name(GuestCookie::RetroScope, $game->id) => "{$pokerGuest->id}|secret"])
        ->withCredentials()
        ->getJson(route('poker.snapshot.show', $game))
        ->assertUnauthorized();

    $retro = Retro::factory()->withGuestAccess()->create();
    $retroGuest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies([GuestCookie::name(GuestCookie::PokerScope, $retro->id) => "{$retroGuest->id}|secret"])
        ->withCredentials()
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertUnauthorized();
});

it('gives members the guest link only while guest access is on', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    [$user] = pokerMember($game);

    $this->actingAs($user)
        ->getJson(route('poker.snapshot.show', $game))
        ->assertJsonPath('game.guestUrl', route('poker.join.show', $game->guest_token));

    $game->update(['guest_access_enabled' => false]);

    $this->actingAs($user)
        ->getJson(route('poker.snapshot.show', $game))
        ->assertJsonPath('game.guestUrl', null);
});
```

- [ ] **Step 2: Write the failing join tests**

Create `tests/Feature/Poker/PokerJoinTest.php`:

```php
<?php

use App\Actions\Retros\GuestCookie;
use App\Models\PokerGame;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('shows the join form for an enabled guest link', function () {
    $game = PokerGame::factory()->withGuestAccess()->create(['title' => 'Sprint 12 sizing']);

    $this->get(route('poker.join.show', $game->guest_token))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('poker/join')
            ->where('isInvalid', false)
            ->where('guestToken', $game->guest_token)
            ->where('gameTitle', 'Sprint 12 sizing')
            ->where('suggestedName', null));
});

it('joins as a guest and resumes with the cookie', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    $cookieName = GuestCookie::name(GuestCookie::PokerScope, $game->id);

    $response = $this->post(route('poker.join.store', $game->guest_token), ['name' => 'Visitor'])
        ->assertRedirect(route('poker.show', $game))
        ->assertCookie($cookieName);

    $guest = $game->players()->where('guest_name', 'Visitor')->sole();
    $cookieValue = $response->getCookie($cookieName, decrypt: true)->getValue();

    expect($guest->user_id)->toBeNull()
        ->and(str_starts_with($cookieValue, $guest->id.'|'))->toBeTrue()
        ->and($guest->guest_secret_hash)->not->toContain(explode('|', $cookieValue)[1]);

    $this->withCookies([$cookieName => $cookieValue])
        ->get(route('poker.join.show', $game->guest_token))
        ->assertRedirect(route('poker.show', $game));

    $this->withCookies([$cookieName => $cookieValue])
        ->get(route('poker.show', $game))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('snapshot.me.isGuest', true));
});

it('requires a display name', function (string $name) {
    $game = PokerGame::factory()->withGuestAccess()->create();

    $this->post(route('poker.join.store', $game->guest_token), ['name' => $name])->assertSessionHasErrors('name');

    expect($game->players()->count())->toBe(0);
})->with(['', '   ', str_repeat('a', 51)]);

it('refuses disabled or unknown links without revealing the game', function (string $kind) {
    $game = PokerGame::factory()->create(['title' => 'Private']);
    $token = $kind === 'disabled' ? $game->guest_token : 'unknown-token';

    $this->get(route('poker.join.show', $token))
        ->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page
            ->component('poker/join')
            ->where('isInvalid', true)
            ->missing('gameTitle'));

    $this->post(route('poker.join.store', $token), ['name' => 'X'])->assertNotFound();
})->with(['disabled', 'unknown']);

it('lets a logged-in non-member join as a guest with their name prefilled', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    $outsider = User::factory()->create(['name' => 'Olga Outside']);

    $this->actingAs($outsider)
        ->get(route('poker.join.show', $game->guest_token))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('suggestedName', 'Olga Outside'));

    $this->actingAs($outsider)
        ->post(route('poker.join.store', $game->guest_token), ['name' => 'Olga Outside'])
        ->assertRedirect(route('poker.show', $game));

    $guest = $game->players()->sole();

    expect($guest->user_id)->toBeNull()
        ->and($guest->guest_name)->toBe('Olga Outside');
});

it('sends team members straight to the game as themselves', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    $user = teamMember($game->team);

    $this->actingAs($user)
        ->get(route('poker.join.show', $game->guest_token))
        ->assertRedirect(route('poker.show', $game));

    expect($game->players()->where('user_id', $user->id)->exists())->toBeTrue();
});
```

- [ ] **Step 3: Write the failing broadcast authorization tests**

Create `tests/Feature/Poker/PokerBroadcastAuthorizationTest.php`:

```php
<?php

use App\Models\PokerGame;
use App\Models\User;

beforeEach(function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => 'test-app',
    ]);
});

function pokerChannelRequest(string $channelName): array
{
    return [
        'socket_id' => '1234.5678',
        'channel_name' => $channelName,
    ];
}

it('signs presence data for a team member', function () {
    $game = PokerGame::factory()->create();
    [$user, $player] = pokerMember($game);

    $response = $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), pokerChannelRequest("presence-poker.{$game->id}"))
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

it('signs presence data for a guest with a valid cookie', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    $guest = pokerGuest($game);

    $response = $this->withCookies(pokerGuestCookie($guest))
        ->withCredentials()
        ->postJson(route('broadcasting.auth'), pokerChannelRequest("presence-poker.{$game->id}"))
        ->assertOk();

    $channelData = json_decode($response->json('channel_data'), true);

    expect($channelData['user_id'])->toBe($guest->id)
        ->and($channelData['user_info']['isGuest'])->toBeTrue();
});

it('refuses guests once guest access is disabled', function () {
    $game = PokerGame::factory()->create();
    $guest = pokerGuest($game);

    $this->withCookies(pokerGuestCookie($guest))
        ->withCredentials()
        ->postJson(route('broadcasting.auth'), pokerChannelRequest("presence-poker.{$game->id}"))
        ->assertForbidden();
});

it('refuses outsiders', function () {
    $game = PokerGame::factory()->create();

    $this->actingAs(User::factory()->create())
        ->postJson(route('broadcasting.auth'), pokerChannelRequest("presence-poker.{$game->id}"))
        ->assertForbidden();
});

it('refuses malformed and unknown poker channels', function (string $channel) {
    $game = PokerGame::factory()->create();
    [$user] = pokerMember($game);

    $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), pokerChannelRequest(str_replace('{game}', strtoupper($game->id), $channel)))
        ->assertForbidden();
})->with([
    'not a uuid' => 'presence-poker.nope',
    'unknown game' => 'presence-poker.00000000-0000-4000-8000-000000000000',
    'uppercase uuid alias' => 'presence-poker.{game}',
]);
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerAccessTest.php tests/Feature/Poker/PokerJoinTest.php tests/Feature/Poker/PokerBroadcastAuthorizationTest.php`
Expected: FAIL — `Route [poker.show] not defined.` / `Route [poker.join.show] not defined.`; the broadcast tests fail with 403 for the member and guest cases.

- [ ] **Step 5: Player resolution**

Create `app/Actions/Poker/ResolvePlayer.php`:

```php
<?php

namespace App\Actions\Poker;

use App\Actions\Retros\GuestCookie;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use Illuminate\Http\Request;

class ResolvePlayer
{
    public function handle(Request $request, PokerGame $game): ?PokerPlayer
    {
        $user = $request->user();

        if ($user !== null && $user->can('view', $game->team)) {
            return PokerPlayer::query()->firstOrCreate([
                'poker_game_id' => $game->id,
                'user_id' => $user->id,
            ]);
        }

        return $this->guest($request, $game);
    }

    private function guest(Request $request, PokerGame $game): ?PokerPlayer
    {
        if (! $game->guest_access_enabled) {
            return null;
        }

        $credentials = GuestCookie::parse($request->cookie(GuestCookie::name(GuestCookie::PokerScope, $game->id)));

        if ($credentials === null) {
            return null;
        }

        [$playerId, $secret] = $credentials;

        $player = $game->players()
            ->whereKey($playerId)
            ->whereNull('user_id')
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

Create `app/Http/Middleware/ResolvePokerPlayer.php`:

```php
<?php

namespace App\Http\Middleware;

use App\Actions\Poker\ResolvePlayer;
use App\Actions\Retros\GuestCookie;
use App\Models\PokerGame;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class ResolvePokerPlayer
{
    public function __construct(private ResolvePlayer $resolvePlayer) {}

    public function handle(Request $request, Closure $next): Response
    {
        $game = $request->route('game');

        abort_unless($game instanceof PokerGame, 404);

        $player = $this->resolvePlayer->handle($request, $game);

        if ($player === null && $request->user() === null && ! $request->expectsJson()) {
            return $this->sendToLogin($request, $game);
        }

        if ($player === null) {
            $hasGuestCookie = $request->cookies->has(GuestCookie::name(GuestCookie::PokerScope, $game->id));

            abort_if($request->user() === null && ! $hasGuestCookie, 401, __('Your session has expired.'));

            abort(403, __('You no longer have access to this game.'));
        }

        $request->attributes->set('pokerPlayer', $player);

        return $next($request);
    }

    /**
     * Once the guest cookie is gone, an expired guest cannot be told apart
     * from a logged-out member, so guest-enabled games explain both ways back.
     */
    private function sendToLogin(Request $request, PokerGame $game): Response
    {
        if (! $game->guest_access_enabled) {
            return redirect()->guest(route('login'));
        }

        redirect()->setIntendedUrl($request->fullUrl());

        return Inertia::render('retros/session-ended')->toResponse($request);
    }
}
```

- [ ] **Step 6: The guard**

Create `app/Actions/Poker/PokerGuard.php`:

```php
<?php

namespace App\Actions\Poker;

use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Validation\ValidationException;

class PokerGuard
{
    public static function facilitator(PokerGame $game, PokerPlayer $player): void
    {
        if ($game->isFacilitator($player)) {
            return;
        }

        throw new AuthorizationException(__('Only the facilitator can do this.'));
    }

    public static function notEnded(PokerGame $game): void
    {
        if (! $game->isEnded()) {
            return;
        }

        throw new AuthorizationException(__('This game has ended.'));
    }

    public static function canEditTasks(PokerPlayer $player): void
    {
        if (! $player->isGuest()) {
            return;
        }

        throw new AuthorizationException(__("Guests can't add or edit tasks."));
    }

    public static function canVote(PokerPlayer $player): void
    {
        if (! $player->is_spectator) {
            return;
        }

        throw new AuthorizationException(__("Spectators can't vote."));
    }

    /**
     * Only the latest round of the current task accepts votes, and only
     * until it is revealed.
     */
    public static function openRound(PokerGame $game, PokerRound $round): void
    {
        $latest = $game->latestRoundOfCurrentTask();

        if ($latest !== null && $latest->id === $round->id && ! $round->isRevealed()) {
            return;
        }

        throw ValidationException::withMessages(['votes' => __('Voting is closed for this round.')]);
    }

    public static function canDelete(PokerGame $game, PokerPlayer $player): void
    {
        if ($game->isFacilitator($player)) {
            return;
        }

        if ($player->user?->canManage($game->team->workspace)) {
            return;
        }

        throw new AuthorizationException(__('Only the facilitator or a workspace admin can delete this game.'));
    }
}
```

- [ ] **Step 7: Game page and snapshot endpoints**

Create `app/Http/Controllers/Poker/PokerGamesController.php`:

```php
<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\BuildPokerSnapshot;
use App\Enums\PokerDeck;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PokerGamesController extends Controller
{
    public function show(Request $request, PokerGame $game, BuildPokerSnapshot $buildPokerSnapshot): Response
    {
        return Inertia::render('poker/show', [
            'snapshot' => $buildPokerSnapshot->handle($game, PokerPlayer::current($request)),
            'deckOptions' => PokerDeck::options(),
        ]);
    }
}
```

Create `app/Http/Controllers/Poker/PokerSnapshotsController.php`:

```php
<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\BuildPokerSnapshot;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PokerSnapshotsController extends Controller
{
    public function show(Request $request, PokerGame $game, BuildPokerSnapshot $buildPokerSnapshot): JsonResponse
    {
        return response()->json($buildPokerSnapshot->handle($game, PokerPlayer::current($request)));
    }
}
```

- [ ] **Step 8: Joining by link**

Create `app/Http/Controllers/PokerJoinsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Poker\ResolvePlayer;
use App\Actions\Retros\GuestCookie;
use App\Models\PokerGame;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class PokerJoinsController extends Controller
{
    public function show(Request $request, string $guestToken, ResolvePlayer $resolvePlayer): Response
    {
        $game = $this->findGame($guestToken);

        if ($game === null) {
            return $this->invalidLink($request);
        }

        if ($resolvePlayer->handle($request, $game) !== null) {
            return to_route('poker.show', $game);
        }

        return Inertia::render('poker/join', [
            'isInvalid' => false,
            'guestToken' => $guestToken,
            'gameTitle' => $game->title,
            'suggestedName' => $request->user()?->name,
        ])->toResponse($request);
    }

    public function store(Request $request, string $guestToken, ResolvePlayer $resolvePlayer): Response
    {
        $game = $this->findGame($guestToken);

        if ($game === null) {
            return $this->invalidLink($request);
        }

        if ($resolvePlayer->handle($request, $game) !== null) {
            return to_route('poker.show', $game);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50'],
        ]);

        $secret = Str::random(40);

        $player = $game->players()->create([
            'guest_name' => $validated['name'],
            'guest_secret_hash' => hash('sha256', $secret),
        ]);

        return to_route('poker.show', $game)
            ->withCookie(GuestCookie::make(GuestCookie::PokerScope, $game->id, $player->id, $secret));
    }

    private function findGame(string $guestToken): ?PokerGame
    {
        return PokerGame::query()
            ->where('guest_token', $guestToken)
            ->where('guest_access_enabled', true)
            ->first();
    }

    private function invalidLink(Request $request): Response
    {
        return Inertia::render('poker/join', ['isInvalid' => true])
            ->toResponse($request)
            ->setStatusCode(404);
    }
}
```

- [ ] **Step 9: Presence channel authorization**

In `app/Http/Controllers/BroadcastAuthorizationsController.php` add the imports `use App\Actions\Poker\ResolvePlayer;` and `use App\Models\PokerGame;`, change `store` to take the resolver and route the new prefix first:

```php
    public function store(Request $request, ResolveParticipant $resolveParticipant, ResolvePlayer $resolvePlayer): JsonResponse
    {
        /** @var array{socket_id: string, channel_name: string} $validated */
        $validated = $request->validate([
            'socket_id' => ['required', 'string', 'regex:/^\d+\.\d+$/'],
            'channel_name' => ['required', 'string'],
        ]);

        if (str_starts_with($validated['channel_name'], 'presence-poker.')) {
            return $this->authorizePokerChannel($request, $validated, $resolvePlayer);
        }

        if (str_starts_with($validated['channel_name'], 'presence-retro.')) {
            return $this->authorizeRetroChannel($request, $validated, $resolveParticipant);
        }

        if (str_starts_with($validated['channel_name'], 'private-participant.')) {
            return $this->authorizeParticipantChannel($request, $validated, $resolveParticipant);
        }

        if (str_starts_with($validated['channel_name'], 'private-retro-members.')) {
            return $this->authorizeRetroMembersChannel($request, $validated, $resolveParticipant);
        }

        if (str_starts_with($validated['channel_name'], 'private-team-action-items.')) {
            return $this->authorizeTeamActionItemsChannel($request, $validated);
        }

        abort(403);
    }
```

and add the method after `authorizeRetroChannel`:

```php
    /**
     * @param  array{socket_id: string, channel_name: string}  $validated
     */
    private function authorizePokerChannel(Request $request, array $validated, ResolvePlayer $resolvePlayer): JsonResponse
    {
        $gameId = Str::after($validated['channel_name'], 'presence-poker.');

        abort_unless(Str::isUuid($gameId), 403);

        $game = PokerGame::query()->find($gameId);

        abort_if($game === null, 403);
        abort_unless($game->id === $gameId, 403);

        $player = $resolvePlayer->handle($request, $game);

        abort_if($player === null, 403);

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

- [ ] **Step 10: Routes**

In `routes/web.php` add the imports

```php
use App\Http\Controllers\Poker\PokerGamesController;
use App\Http\Controllers\Poker\PokerSnapshotsController;
use App\Http\Controllers\PokerJoinsController;
use App\Http\Middleware\ResolvePokerPlayer;
```

and, right after the closing `});` of the `Route::prefix('retros/{retro}')` group (before the `broadcasting/auth` line):

```php
Route::get('poker/join/{guestToken}', [PokerJoinsController::class, 'show'])->name('poker.join.show');
Route::post('poker/join/{guestToken}', [PokerJoinsController::class, 'store'])->name('poker.join.store')->middleware('throttle:10,1');

Route::prefix('poker/{game}')
    ->whereUuid('game')
    ->middleware(ResolvePokerPlayer::class)
    ->scopeBindings()
    ->group(function () {
        Route::get('/', [PokerGamesController::class, 'show'])->name('poker.show');
        Route::get('snapshot', [PokerSnapshotsController::class, 'show'])->name('poker.snapshot.show');
    });
```

- [ ] **Step 11: Pages and layouts**

Create `resources/js/pages/poker/join.tsx`:

```tsx
import { Form, Head } from '@inertiajs/react';
import PokerJoinsController from '@/actions/App/Http/Controllers/PokerJoinsController';
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
          gameTitle: string;
          suggestedName: string | null;
      };

export default function JoinPokerGame(props: Props) {
    const { t } = useTrans();

    if (props.isInvalid) {
        return (
            <>
                <Head title={t('Join a planning poker game')} />
                <Heading
                    title={t('Join a planning poker game')}
                    description={t('This guest link is no longer valid.')}
                />
            </>
        );
    }

    return (
        <>
            <Head title={props.gameTitle} />
            <div className="space-y-6">
                <Heading
                    title={props.gameTitle}
                    description={t('Choose the name other players will see.')}
                />
                <Form
                    {...PokerJoinsController.store.form(props.guestToken)}
                    className="space-y-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="name">
                                    {t('Display name')}
                                </Label>
                                <Input
                                    id="name"
                                    name="name"
                                    required
                                    maxLength={50}
                                    autoFocus
                                    defaultValue={props.suggestedName ?? ''}
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

Create `resources/js/pages/poker/show.tsx` (placeholder so the Inertia page exists; Task 14 replaces it):

```tsx
import { Head } from '@inertiajs/react';

type Props = { snapshot: { game: { title: string } } };

export default function ShowPokerGame({ snapshot }: Props) {
    return <Head title={snapshot.game.title} />;
}
```

In `resources/js/app.tsx`, inside the `layout` switch, extend the two retro cases:

```tsx
            case name === 'retros/join':
            case name === 'retros/session-ended':
            case name === 'poker/join':
                return AuthLayout;
            case name === 'retros/show':
            case name === 'poker/show':
                return null;
```

- [ ] **Step 12: Generate routes and translations**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form`

Append to `lang/en.json` (before the closing `}`, adding a comma to the previous last line):

```json
    "This game has ended.": "This game has ended.",
    "Guests can't add or edit tasks.": "Guests can't add or edit tasks.",
    "Spectators can't vote.": "Spectators can't vote.",
    "Only the facilitator or a workspace admin can delete this game.": "Only the facilitator or a workspace admin can delete this game.",
    "You no longer have access to this game.": "You no longer have access to this game.",
    "Voting is closed for this round.": "Voting is closed for this round.",
    "Join a planning poker game": "Join a planning poker game",
    "Choose the name other players will see.": "Choose the name other players will see."
```

`lang/fr.json`:

```json
    "This game has ended.": "Cette partie est terminée.",
    "Guests can't add or edit tasks.": "Les invités ne peuvent pas ajouter ni modifier de tâches.",
    "Spectators can't vote.": "Les spectateurs ne peuvent pas voter.",
    "Only the facilitator or a workspace admin can delete this game.": "Seul l'animateur ou un administrateur de l'espace de travail peut supprimer cette partie.",
    "You no longer have access to this game.": "Vous n'avez plus accès à cette partie.",
    "Voting is closed for this round.": "Le vote est clos pour ce tour.",
    "Join a planning poker game": "Rejoindre une partie de planning poker",
    "Choose the name other players will see.": "Choisissez le nom que les autres joueurs verront."
```

`lang/es.json`:

```json
    "This game has ended.": "Esta partida ha terminado.",
    "Guests can't add or edit tasks.": "Los invitados no pueden añadir ni editar tareas.",
    "Spectators can't vote.": "Los espectadores no pueden votar.",
    "Only the facilitator or a workspace admin can delete this game.": "Solo el facilitador o un administrador del espacio de trabajo puede eliminar esta partida.",
    "You no longer have access to this game.": "Ya no tienes acceso a esta partida.",
    "Voting is closed for this round.": "La votación de esta ronda está cerrada.",
    "Join a planning poker game": "Unirse a una partida de planning poker",
    "Choose the name other players will see.": "Elige el nombre que verán los demás jugadores."
```

`lang/de.json`:

```json
    "This game has ended.": "Dieses Spiel ist beendet.",
    "Guests can't add or edit tasks.": "Gäste können keine Aufgaben hinzufügen oder bearbeiten.",
    "Spectators can't vote.": "Zuschauer können nicht abstimmen.",
    "Only the facilitator or a workspace admin can delete this game.": "Nur die Moderation oder ein Workspace-Admin kann dieses Spiel löschen.",
    "You no longer have access to this game.": "Du hast keinen Zugriff mehr auf dieses Spiel.",
    "Voting is closed for this round.": "Die Abstimmung für diese Runde ist geschlossen.",
    "Join a planning poker game": "Einem Planning-Poker-Spiel beitreten",
    "Choose the name other players will see.": "Wähle den Namen, den die anderen Spieler sehen."
```

(Before appending, check each key with `grep -n '"Voting is closed for this round."' lang/en.json` etc.; add only missing keys.)

- [ ] **Step 13: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerAccessTest.php tests/Feature/Poker/PokerJoinTest.php tests/Feature/Poker/PokerBroadcastAuthorizationTest.php tests/Feature/Retros/BroadcastAuthorizationTest.php tests/Feature/Retros/RetroAccessTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 14: Format, analyse, type-check**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress && npm run types:check && npx vp check --fix resources/js/pages/poker/join.tsx resources/js/pages/poker/show.tsx resources/js/app.tsx`
Expected: no errors.

- [ ] **Step 15: Commit**

```bash
git add app/Actions/Poker/ResolvePlayer.php app/Actions/Poker/PokerGuard.php app/Http/Middleware/ResolvePokerPlayer.php app/Http/Controllers/PokerJoinsController.php app/Http/Controllers/Poker/PokerGamesController.php app/Http/Controllers/Poker/PokerSnapshotsController.php app/Http/Controllers/BroadcastAuthorizationsController.php routes/web.php resources/js/pages/poker/join.tsx resources/js/pages/poker/show.tsx resources/js/app.tsx lang/en.json lang/fr.json lang/es.json lang/de.json tests/Feature/Poker/PokerAccessTest.php tests/Feature/Poker/PokerJoinTest.php tests/Feature/Poker/PokerBroadcastAuthorizationTest.php
git commit -m "feat: let members and guests enter poker games

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

### Task 6: Creating games and the team page data (`CreatePokerGame`, `TeamPokerGamesController`)

**Files:**
- Create: `app/Actions/Poker/{NewPokerGame,PokerDeckRules,CreatePokerGame,PresentPokerGameSummary}.php`, `app/Http/Controllers/TeamPokerGamesController.php`
- Modify: `app/Policies/TeamPolicy.php` (`createPokerGame` = `view`), `app/Http/Controllers/TeamsController.php` (props `pokerGames`, `pokerDeckOptions`, `canCreatePokerGame`), `routes/web.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Poker/CreatePokerGameTest.php`, `tests/Feature/Poker/TeamPokerSectionTest.php`

**Interfaces:**
- Consumes: Task 2 (`PokerDeck` incl. `cards()`, `isSpecial()`, `options()`, `UnknownCard`, `CoffeeCard`; `PokerGame::{isNumeric(), deckLabel()}`, `Team::pokerGames()`, factories), Task 5 (route `poker.show`).
- Produces:
  - `readonly class NewPokerGame { __construct(public string $title, public PokerDeck $deck, public array $cards, public ?string $deckName = null, public bool $anonymousVotes = false, public bool $autoReveal = false) }`.
  - `PokerDeckRules::rules(bool $deckRequired = true): array`, `PokerDeckRules::cardListRules(): array`, `PokerDeckRules::cardRules(): array`, `PokerDeckRules::withSpecialCards(array $cards, bool $includeUnknown, bool $includeCoffee): array<int, string>`, `PokerDeckRules::resolve(array $validated): array{0: PokerDeck, 1: array<int, string>}`.
  - `CreatePokerGame::handle(Team $team, User $creator, NewPokerGame $new): PokerGame`.
  - `PresentPokerGameSummary::handle(PokerGame $game): array{id: string, title: string, deckLabel: string, tasksCount: int, estimatedCount: int, totalPoints: ?float, endedAt: ?string, lastActivityAt: string}` and `PresentPokerGameSummary::withCounts(HasMany|Builder $query): HasMany|Builder` (adds the `withCount`/`withSum` the presenter reads).
  - `TeamPolicy::createPokerGame(User, Team): bool`.
  - Route `teams.pokerGames.store` (`POST /w/{workspace}/teams/{team}/poker-games`).
  - `TeamsController::show` props `pokerGames`, `pokerDeckOptions`, `canCreatePokerGame`.

- [ ] **Step 1: Write the failing creation tests**

Create `tests/Feature/Poker/CreatePokerGameTest.php`:

```php
<?php

use App\Enums\PokerDeck;
use App\Enums\WorkspaceRole;
use App\Models\PokerGame;
use App\Models\Team;
use App\Models\User;

function createPokerGameRequest(array $overrides = []): array
{
    return [
        'title' => 'Sprint 12 sizing',
        'deck' => PokerDeck::Fibonacci->value,
        ...$overrides,
    ];
}

function postPokerGame(mixed $test, User $user, Team $team, array $payload): mixed
{
    return $test->actingAs($user)->post(route('teams.pokerGames.store', [$team->workspace, $team]), $payload);
}

it('creates a game with each deck', function (PokerDeck $deck, array $extra, array $expectedCards) {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $response = postPokerGame($this, $user, $team, createPokerGameRequest(['deck' => $deck->value, ...$extra]));

    $game = PokerGame::query()->sole();

    $response->assertRedirect(route('poker.show', $game));

    $player = $game->players()->sole();

    expect($game->team_id)->toBe($team->id)
        ->and($game->title)->toBe('Sprint 12 sizing')
        ->and($game->deck)->toBe($deck)
        ->and($game->cards)->toBe($expectedCards)
        ->and($game->deck_name)->toBeNull()
        ->and($game->guest_access_enabled)->toBeFalse()
        ->and(strlen($game->guest_token))->toBe(40)
        ->and($player->user_id)->toBe($user->id)
        ->and($game->facilitator_player_id)->toBe($player->id);
})->with([
    'fibonacci' => [PokerDeck::Fibonacci, [], PokerDeck::Fibonacci->cards()],
    'modified fibonacci' => [PokerDeck::ModifiedFibonacci, [], PokerDeck::ModifiedFibonacci->cards()],
    't-shirt' => [PokerDeck::Tshirt, [], PokerDeck::Tshirt->cards()],
    'powers of two' => [PokerDeck::PowersOfTwo, [], PokerDeck::PowersOfTwo->cards()],
    'custom' => [PokerDeck::Custom, ['custom_cards' => ['1', '2', '3']], ['1', '2', '3', '?', '☕']],
]);

it('validates custom decks', function (array $customCards, array $flags, ?array $expectedCards) {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $response = postPokerGame($this, $user, $team, createPokerGameRequest([
        'deck' => PokerDeck::Custom->value,
        'custom_cards' => $customCards,
        ...$flags,
    ]));

    if ($expectedCards === null) {
        $response->assertSessionHasErrors();
        expect(PokerGame::query()->count())->toBe(0);

        return;
    }

    $response->assertSessionHasNoErrors();
    expect(PokerGame::query()->sole()->cards)->toBe($expectedCards);
})->with([
    'collide after trimming' => [[' 3', '3', '5'], [], null],
    'nine multibyte characters' => [['ＡＢＣＤＥＦＧＨＩ', '1'], [], null],
    'only special cards' => [['?', '☕'], [], null],
    'twenty-one cards' => [array_map('strval', range(1, 21)), [], null],
    'a single card' => [['1'], [], null],
    'blank card' => [['1', '   '], [], null],
    '? typed and requested' => [['1', '2', '?'], ['include_unknown' => true, 'include_coffee' => true], ['1', '2', '?', '☕']],
    'no special cards asked' => [['S', 'M', 'L'], ['include_unknown' => false, 'include_coffee' => false], ['S', 'M', 'L']],
    'eight multibyte characters' => [['ＡＢＣＤＥＦＧＨ', '1'], ['include_unknown' => false, 'include_coffee' => false], ['ＡＢＣＤＥＦＧＨ', '1']],
    'twenty cards' => [array_map('strval', range(1, 20)), ['include_unknown' => false, 'include_coffee' => false], array_map('strval', range(1, 20))],
]);

it('ignores custom cards for built-in decks', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    postPokerGame($this, $user, $team, createPokerGameRequest(['custom_cards' => ['x']]))->assertSessionHasNoErrors();

    expect(PokerGame::query()->sole()->cards)->toBe(PokerDeck::Fibonacci->cards());
});

it('requires a title and a known deck', function (array $payload, string $field) {
    $team = Team::factory()->create();
    $user = teamMember($team);

    postPokerGame($this, $user, $team, createPokerGameRequest($payload))->assertSessionHasErrors($field);
})->with([
    'no title' => [['title' => ''], 'title'],
    'long title' => [['title' => str_repeat('a', 121)], 'title'],
    'unknown deck' => [['deck' => 'bananas'], 'deck'],
]);

it('stores anonymous votes and auto-reveal from the form', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    postPokerGame($this, $user, $team, createPokerGameRequest(['anonymous_votes' => true, 'auto_reveal' => true]))
        ->assertSessionHasNoErrors();

    $game = PokerGame::query()->sole();

    expect($game->anonymous_votes)->toBeTrue()
        ->and($game->auto_reveal)->toBeTrue();
});

it('refuses non-members', function () {
    $team = Team::factory()->create();
    $outsider = User::factory()->create();
    $team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    postPokerGame($this, $outsider, $team, createPokerGameRequest())->assertForbidden();

    expect(PokerGame::query()->count())->toBe(0);
});

it('lets workspace managers create games for any team', function () {
    $team = Team::factory()->create();
    $admin = workspaceManager($team->workspace);

    postPokerGame($this, $admin, $team, createPokerGameRequest())->assertRedirect();

    expect(PokerGame::query()->sole()->facilitator->user_id)->toBe($admin->id);
});
```

- [ ] **Step 2: Write the failing team page tests**

Create `tests/Feature/Poker/TeamPokerSectionTest.php`:

```php
<?php

use App\Enums\PokerDeck;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

function pokerTeamPage(mixed $test, User $user, Team $team): mixed
{
    return $test->actingAs($user)->get(route('teams.show', [$team->workspace, $team]));
}

it('lists active and ended games with counts on the team page', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $this->travelTo(now()->subHours(2));
    $ended = PokerGame::factory()->ended()->create(['team_id' => $team->id, 'title' => 'Ended game']);
    PokerTask::factory()->create(['poker_game_id' => $ended->id]);

    $this->travelTo(now()->addHour());
    $sized = PokerGame::factory()->deck(PokerDeck::Tshirt)->create(['team_id' => $team->id, 'title' => 'Shirts']);
    PokerTask::factory()->create(['poker_game_id' => $sized->id, 'estimate' => 'M', 'estimate_numeric' => null, 'estimated_at' => now()]);

    $this->travelBack();
    $active = PokerGame::factory()->create(['team_id' => $team->id, 'title' => 'Active game']);
    PokerTask::factory()->create(['poker_game_id' => $active->id, 'estimate' => '3', 'estimate_numeric' => 3, 'estimated_at' => now()]);
    PokerTask::factory()->create(['poker_game_id' => $active->id, 'estimate' => '5', 'estimate_numeric' => 5, 'estimated_at' => now()]);
    PokerTask::factory()->create(['poker_game_id' => $active->id]);

    pokerTeamPage($this, $user, $team)
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/show')
            ->where('canCreatePokerGame', true)
            ->has('pokerDeckOptions', 5)
            ->has('pokerGames', 3)
            ->where('pokerGames.0.id', $active->id)
            ->where('pokerGames.0.deckLabel', 'Fibonacci')
            ->where('pokerGames.0.tasksCount', 3)
            ->where('pokerGames.0.estimatedCount', 2)
            ->where('pokerGames.0.totalPoints', 8.0)
            ->where('pokerGames.0.endedAt', null)
            ->where('pokerGames.1.id', $sized->id)
            ->where('pokerGames.1.totalPoints', null)
            ->where('pokerGames.1.estimatedCount', 1)
            ->where('pokerGames.2.id', $ended->id)
            ->where('pokerGames.2.tasksCount', 1)
            ->where('pokerGames.2.estimatedCount', 0)
            ->where('pokerGames.2.totalPoints', 0.0)
            ->whereNot('pokerGames.2.endedAt', null)
            ->has('pokerGames.0.lastActivityAt'));
});

it('only lists the games of the team', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    PokerGame::factory()->create();

    pokerTeamPage($this, $user, $team)->assertInertia(fn (Assert $page) => $page->has('pokerGames', 0));
});

it('keeps the team page query count constant as games grow', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $seed = function (int $count) use ($team): void {
        PokerGame::factory()->count($count)->create(['team_id' => $team->id])
            ->each(fn (PokerGame $game) => PokerTask::factory()->count(2)->create([
                'poker_game_id' => $game->id,
                'estimate' => '3',
                'estimate_numeric' => 3,
                'estimated_at' => now(),
            ]));
    };
    $countQueries = function () use ($team, $user): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        pokerTeamPage($this, $user, $team)->assertOk();
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $seed(2);
    $countQueries();
    $small = $countQueries();

    $seed(6);

    expect($countQueries())->toBe($small);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/CreatePokerGameTest.php tests/Feature/Poker/TeamPokerSectionTest.php`
Expected: FAIL — `Route [teams.pokerGames.store] not defined.`; the team page tests fail on the missing `pokerGames` prop.

- [ ] **Step 4: DTO and deck rules**

Create `app/Actions/Poker/NewPokerGame.php`:

```php
<?php

namespace App\Actions\Poker;

use App\Enums\PokerDeck;

readonly class NewPokerGame
{
    /**
     * @param  array<int, string>  $cards
     */
    public function __construct(
        public string $title,
        public PokerDeck $deck,
        public array $cards,
        public ?string $deckName = null,
        public bool $anonymousVotes = false,
        public bool $autoReveal = false,
    ) {}
}
```

Create `app/Actions/Poker/PokerDeckRules.php`:

```php
<?php

namespace App\Actions\Poker;

use App\Enums\PokerDeck;
use Closure;
use Illuminate\Validation\Rule;

class PokerDeckRules
{
    public const MinCards = 2;

    public const MaxCards = 20;

    /**
     * @return array<string, array<int, mixed>>
     */
    public static function rules(bool $deckRequired = true): array
    {
        return [
            'deck' => [$deckRequired ? 'required' : 'sometimes', Rule::enum(PokerDeck::class)],
            'custom_cards' => ['exclude_unless:deck,'.PokerDeck::Custom->value, ...self::cardListRules()],
            'custom_cards.*' => self::cardRules(),
            'include_unknown' => ['sometimes', 'boolean'],
            'include_coffee' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * Rules for a list of cards typed by a person, before `?` and `☕` are
     * appended by the checkboxes.
     *
     * @return array<int, mixed>
     */
    public static function cardListRules(): array
    {
        return [
            'required',
            'array',
            function (string $attribute, mixed $value, Closure $fail): void {
                if (! is_array($value)) {
                    return;
                }

                if (count($value) < self::MinCards || count($value) > self::MaxCards) {
                    $fail(__('Give between 2 and 20 cards.'));

                    return;
                }

                $cards = array_map(fn (mixed $card): string => is_string($card) ? trim($card) : '', array_values($value));

                if (count(array_unique($cards)) !== count($cards)) {
                    $fail(__('Each card can appear only once.'));

                    return;
                }

                $estimates = array_filter($cards, fn (string $card): bool => $card !== '' && ! PokerDeck::isSpecial($card));

                if ($estimates === []) {
                    $fail(__('Add at least one card that can be an estimate.'));
                }
            },
        ];
    }

    /**
     * @return array<int, string>
     */
    public static function cardRules(): array
    {
        return ['required', 'string', 'max:8'];
    }

    /**
     * @param  array<int, string>  $cards
     * @return array<int, string>
     */
    public static function withSpecialCards(array $cards, bool $includeUnknown, bool $includeCoffee): array
    {
        $cards = array_values(array_map('trim', $cards));

        if ($includeUnknown && ! in_array(PokerDeck::UnknownCard, $cards, true)) {
            $cards[] = PokerDeck::UnknownCard;
        }

        if ($includeCoffee && ! in_array(PokerDeck::CoffeeCard, $cards, true)) {
            $cards[] = PokerDeck::CoffeeCard;
        }

        return $cards;
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array{0: PokerDeck, 1: array<int, string>}
     */
    public static function resolve(array $validated): array
    {
        $deck = PokerDeck::from((string) $validated['deck']);

        if ($deck !== PokerDeck::Custom) {
            return [$deck, $deck->cards()];
        }

        /** @var array<int, string> $customCards */
        $customCards = $validated['custom_cards'];

        return [$deck, self::withSpecialCards(
            $customCards,
            (bool) ($validated['include_unknown'] ?? true),
            (bool) ($validated['include_coffee'] ?? true),
        )];
    }
}
```

- [ ] **Step 5: Creating the game**

Create `app/Actions/Poker/CreatePokerGame.php`:

```php
<?php

namespace App\Actions\Poker;

use App\Models\PokerGame;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreatePokerGame
{
    public function handle(Team $team, User $creator, NewPokerGame $new): PokerGame
    {
        return DB::transaction(function () use ($team, $creator, $new): PokerGame {
            $game = $team->pokerGames()->create([
                'title' => $new->title,
                'deck' => $new->deck,
                'cards' => $new->cards,
                'deck_name' => $new->deckName,
                'anonymous_votes' => $new->anonymousVotes,
                'auto_reveal' => $new->autoReveal,
                'guest_token' => Str::random(40),
            ]);

            $player = $game->players()->create(['user_id' => $creator->id]);

            $game->update(['facilitator_player_id' => $player->id]);

            return $game;
        });
    }
}
```

Add to `app/Policies/TeamPolicy.php` (after `createRetro`):

```php
    public function createPokerGame(User $user, Team $team): bool
    {
        return $this->view($user, $team);
    }
```

Create `app/Http/Controllers/TeamPokerGamesController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Poker\CreatePokerGame;
use App\Actions\Poker\NewPokerGame;
use App\Actions\Poker\PokerDeckRules;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TeamPokerGamesController extends Controller
{
    public function store(Request $request, Workspace $workspace, Team $team, CreatePokerGame $createPokerGame): RedirectResponse
    {
        Gate::authorize('createPokerGame', $team);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            ...PokerDeckRules::rules(),
            'anonymous_votes' => ['sometimes', 'boolean'],
            'auto_reveal' => ['sometimes', 'boolean'],
        ]);

        [$deck, $cards] = PokerDeckRules::resolve($validated);

        $game = $createPokerGame->handle($team, $request->user(), new NewPokerGame(
            title: $validated['title'],
            deck: $deck,
            cards: $cards,
            anonymousVotes: (bool) ($validated['anonymous_votes'] ?? false),
            autoReveal: (bool) ($validated['auto_reveal'] ?? false),
        ));

        return to_route('poker.show', $game);
    }
}
```

In `routes/web.php` add `use App\Http\Controllers\TeamPokerGamesController;` and, right after the `teams/{team}/retros` line inside the `w/{workspace}` group:

```php
            Route::post('teams/{team}/poker-games', [TeamPokerGamesController::class, 'store'])->name('teams.pokerGames.store');
```

- [ ] **Step 6: Team page data**

Create `app/Actions/Poker/PresentPokerGameSummary.php`:

```php
<?php

namespace App\Actions\Poker;

use App\Models\PokerGame;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PresentPokerGameSummary
{
    /**
     * @template TQuery of HasMany<PokerGame, *>|Builder<PokerGame>
     *
     * @param  TQuery  $query
     * @return TQuery
     */
    public static function withCounts(HasMany|Builder $query): HasMany|Builder
    {
        return $query
            ->withCount(['tasks', 'tasks as estimated_tasks_count' => fn (Builder $tasks) => $tasks->whereNotNull('estimated_at')])
            ->withSum('tasks as total_points', 'estimate_numeric');
    }

    /**
     * @return array{
     *     id: string,
     *     title: string,
     *     deckLabel: string,
     *     tasksCount: int,
     *     estimatedCount: int,
     *     totalPoints: ?float,
     *     endedAt: ?string,
     *     lastActivityAt: string
     * }
     */
    public function handle(PokerGame $game): array
    {
        return [
            'id' => $game->id,
            'title' => $game->title,
            'deckLabel' => $game->deckLabel(),
            'tasksCount' => (int) $game->getAttribute('tasks_count'),
            'estimatedCount' => (int) $game->getAttribute('estimated_tasks_count'),
            'totalPoints' => $game->isNumeric() ? round((float) $game->getAttribute('total_points'), 2) : null,
            'endedAt' => $game->ended_at?->toIso8601String(),
            'lastActivityAt' => $game->updated_at?->toIso8601String() ?? '',
        ];
    }
}
```

In `app/Http/Controllers/TeamsController.php` add the imports `use App\Actions\Poker\PresentPokerGameSummary;`, `use App\Enums\PokerDeck;`, `use App\Models\PokerGame;`, extend the constructor:

```php
    public function __construct(
        private TeamHealthStatements $teamHealthStatements,
        private PresentHealthStatement $presentHealthStatement,
        private PresentPokerGameSummary $presentPokerGameSummary,
    ) {}
```

and add, after the `'canManageHealthStatements' => …` entry of the `teams/show` props:

```php
            'pokerGames' => PresentPokerGameSummary::withCounts($team->pokerGames())
                ->latest('updated_at')
                ->get()
                ->map(fn (PokerGame $game) => $this->presentPokerGameSummary->handle($game)),
            'pokerDeckOptions' => PokerDeck::options(),
            'canCreatePokerGame' => $request->user()->can('createPokerGame', $team),
```

(`withCount`/`withSum` drop the `tasks()` ordering from their subqueries, so PostgreSQL accepts them.)

- [ ] **Step 7: Translations**

Append to `lang/en.json`:

```json
    "Give between 2 and 20 cards.": "Give between 2 and 20 cards.",
    "Each card can appear only once.": "Each card can appear only once.",
    "Add at least one card that can be an estimate.": "Add at least one card that can be an estimate."
```

`lang/fr.json`:

```json
    "Give between 2 and 20 cards.": "Indiquez entre 2 et 20 cartes.",
    "Each card can appear only once.": "Chaque carte ne peut apparaître qu'une fois.",
    "Add at least one card that can be an estimate.": "Ajoutez au moins une carte pouvant servir d'estimation."
```

`lang/es.json`:

```json
    "Give between 2 and 20 cards.": "Indica entre 2 y 20 cartas.",
    "Each card can appear only once.": "Cada carta solo puede aparecer una vez.",
    "Add at least one card that can be an estimate.": "Añade al menos una carta que pueda ser una estimación."
```

`lang/de.json`:

```json
    "Give between 2 and 20 cards.": "Gib zwischen 2 und 20 Karten an.",
    "Each card can appear only once.": "Jede Karte darf nur einmal vorkommen.",
    "Add at least one card that can be an estimate.": "Füge mindestens eine Karte hinzu, die eine Schätzung sein kann."
```

- [ ] **Step 8: Generate routes and run the tests**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form`
Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/CreatePokerGameTest.php tests/Feature/Poker/TeamPokerSectionTest.php tests/Feature/Teams tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 9: Format and analyse**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress`
Expected: no errors. If phpstan rejects the template on `withCounts`, replace the template docblock with `@param HasMany<PokerGame, Team> $query` / `@return HasMany<PokerGame, Team>` and type the parameter as `HasMany` only (the controller is the single caller).

- [ ] **Step 10: Commit**

```bash
git add app/Actions/Poker/NewPokerGame.php app/Actions/Poker/PokerDeckRules.php app/Actions/Poker/CreatePokerGame.php app/Actions/Poker/PresentPokerGameSummary.php app/Http/Controllers/TeamPokerGamesController.php app/Http/Controllers/TeamsController.php app/Policies/TeamPolicy.php routes/web.php lang/en.json lang/fr.json lang/es.json lang/de.json tests/Feature/Poker/CreatePokerGameTest.php tests/Feature/Poker/TeamPokerSectionTest.php
git commit -m "feat: create poker games from the team page

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

#### Implementer notes

- The outline describes the counts only in prose; this task adds the static `PresentPokerGameSummary::withCounts()` so the eager aggregates live next to the presenter that reads them (Task 17 and 10b need nothing from it).
- `poker_games.updated_at` stands for "last activity" through the `$touches` cascade of Task 2; the team-page ordering test relies on it (`latest('updated_at')`).

### Task 7: Tasks (`AddPokerTask`, task CRUD, reorder)

**Files:**
- Create: `app/Actions/Poker/AddPokerTask.php`, `app/Http/Controllers/Poker/PokerTasksController.php`, `app/Http/Controllers/Poker/PokerTaskOrdersController.php`
- Modify: `routes/web.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Poker/PokerTasksTest.php`

**Interfaces:**
- Consumes: `PokerGuard::{notEnded, canEditTasks, facilitator}` (Task 5), `PresentPokerTask::handle(PokerTask): array` (Task 4), `PokerTaskSaved`, `PokerTaskDeleted`, `PokerTasksReordered` (Task 4), `PokerPlayer::current()`, Pest helpers `pokerFacilitator`, `pokerMember`, `pokerGuest`, `pokerGuestCookie`, `openPokerRound` (Task 2), route `poker.snapshot.show` (Task 5).
- Produces:
  - `AddPokerTask::MaxTasks = 200`; `AddPokerTask::handle(PokerGame $locked, string $title, ?string $description): PokerTask`.
  - `PokerTasksController::{store, update, destroy}`, `PokerTaskOrdersController::update`.
  - Routes `poker.tasks.store`, `poker.tasks.update`, `poker.tasks.destroy`, `poker.task-order.update`.
  - Responses: `store` 201 task payload, `update` 200 task payload (both with `roundsCount` from `loadCount('rounds')`), `destroy` 204, task order 204.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Poker/PokerTasksTest.php`:

```php
<?php

use App\Events\Poker\PokerTaskDeleted;
use App\Events\Poker\PokerTaskSaved;
use App\Events\Poker\PokerTasksReordered;
use App\Models\PokerGame;
use App\Models\PokerRound;
use App\Models\PokerTask;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array{0: PokerGame, 1: \App\Models\User, 2: \App\Models\User}
 */
function pokerTasksSetup(array $gameAttributes = []): array
{
    $game = PokerGame::factory()->withGuestAccess()->create($gameAttributes);
    [$facilitator] = pokerFacilitator($game);
    [$member] = pokerMember($game);

    return [$game, $facilitator, $member];
}

it('adds tasks as facilitator or member', function () {
    [$game, $facilitator, $member] = pokerTasksSetup();

    $this->actingAs($facilitator)
        ->postJson(route('poker.tasks.store', $game), ['title' => 'Login page', 'description' => 'As a **user**'])
        ->assertCreated()
        ->assertJsonPath('title', 'Login page')
        ->assertJsonPath('position', 1)
        ->assertJsonPath('roundsCount', 0)
        ->assertJsonPath('estimate', null)
        ->assertJsonPath('external', null);

    $this->actingAs($member)
        ->postJson(route('poker.tasks.store', $game), ['title' => 'Signup page'])
        ->assertCreated()
        ->assertJsonPath('position', 2)
        ->assertJsonPath('description', null)
        ->assertJsonPath('descriptionHtml', '');

    expect($game->tasks()->pluck('title')->all())->toBe(['Login page', 'Signup page']);
});

it('validates task fields', function (array $payload, string $field) {
    [$game, $facilitator] = pokerTasksSetup();

    $this->actingAs($facilitator)
        ->postJson(route('poker.tasks.store', $game), $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'no title' => [['title' => ''], 'title'],
    'long title' => [['title' => str_repeat('a', 201)], 'title'],
    'long description' => [['title' => 'A', 'description' => str_repeat('a', 10001)], 'description'],
]);

it('refuses guests', function () {
    [$game] = pokerTasksSetup();
    $guest = pokerGuest($game);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id]);

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->postJson(route('poker.tasks.store', $game), ['title' => 'Sneaky'])
        ->assertForbidden()
        ->assertJsonPath('message', "Guests can't add or edit tasks.");

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->patchJson(route('poker.tasks.update', [$game, $task]), ['title' => 'Sneaky'])
        ->assertForbidden();

    expect($game->tasks()->count())->toBe(1)
        ->and($task->fresh()->title)->not->toBe('Sneaky');
});

it('edits title and description', function () {
    [$game, , $member] = pokerTasksSetup();
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Old']);

    $this->actingAs($member)
        ->patchJson(route('poker.tasks.update', [$game, $task]), ['description' => 'Now **bold**'])
        ->assertOk()
        ->assertJsonPath('title', 'Old')
        ->assertJsonPath('description', 'Now **bold**')
        ->assertJsonPath('descriptionHtml', fn (string $html) => str_contains($html, '<strong>bold</strong>'));

    $this->actingAs($member)
        ->patchJson(route('poker.tasks.update', [$game, $task]), ['title' => 'New', 'description' => null])
        ->assertOk()
        ->assertJsonPath('title', 'New')
        ->assertJsonPath('description', null);

    Event::assertDispatched(PokerTaskSaved::class, 2);
});

it('answers 404 for a task of another game', function () {
    [$game, $facilitator] = pokerTasksSetup();
    $foreign = PokerTask::factory()->create();

    $this->actingAs($facilitator)
        ->patchJson(route('poker.tasks.update', [$game, $foreign]), ['title' => 'X'])
        ->assertNotFound();
});

it('limits a game to 200 tasks', function () {
    [$game, $facilitator] = pokerTasksSetup();
    PokerTask::factory()->count(200)
        ->sequence(fn ($sequence) => ['position' => $sequence->index + 1])
        ->create(['poker_game_id' => $game->id]);

    $this->actingAs($facilitator)
        ->postJson(route('poker.tasks.store', $game), ['title' => 'One too many'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.title.0', 'This game already has 200 tasks.');

    expect($game->tasks()->count())->toBe(200);
});

it('lets only the facilitator delete and reorder', function () {
    [$game, $facilitator, $member] = pokerTasksSetup();
    $first = PokerTask::factory()->create(['poker_game_id' => $game->id, 'position' => 1]);
    $second = PokerTask::factory()->create(['poker_game_id' => $game->id, 'position' => 2]);

    $this->actingAs($member)->deleteJson(route('poker.tasks.destroy', [$game, $first]))->assertForbidden();
    $this->actingAs($member)
        ->putJson(route('poker.task-order.update', $game), ['task_ids' => [$second->id, $first->id]])
        ->assertForbidden();

    $this->actingAs($facilitator)
        ->putJson(route('poker.task-order.update', $game), ['task_ids' => [$second->id, $first->id]])
        ->assertNoContent();

    expect($game->tasks()->pluck('id')->all())->toBe([$second->id, $first->id]);

    $this->actingAs($facilitator)->deleteJson(route('poker.tasks.destroy', [$game, $first]))->assertNoContent();

    expect(PokerTask::query()->whereKey($first->id)->exists())->toBeFalse();
    Event::assertDispatched(PokerTaskDeleted::class, fn (PokerTaskDeleted $event) => $event->broadcastWith() === ['taskId' => $first->id]);
});

it('clears the current task when it is deleted', function () {
    [$game, $facilitator] = pokerTasksSetup();
    $round = openPokerRound($game);
    [$voter, $voterPlayer] = pokerMember($game);
    pokerVote($round, $voterPlayer, '5');

    $this->actingAs($facilitator)
        ->deleteJson(route('poker.tasks.destroy', [$game, $round->task]))
        ->assertNoContent();

    expect($game->fresh()->current_task_id)->toBeNull()
        ->and(PokerRound::query()->whereKey($round->id)->exists())->toBeFalse();

    $this->actingAs($voter)
        ->getJson(route('poker.snapshot.show', $game))
        ->assertOk()
        ->assertJsonPath('current', null)
        ->assertJsonPath('game.currentTaskId', null);
});

it('refuses stale or foreign task orders', function (string $case) {
    [$game, $facilitator] = pokerTasksSetup();
    $first = PokerTask::factory()->create(['poker_game_id' => $game->id, 'position' => 1]);
    $second = PokerTask::factory()->create(['poker_game_id' => $game->id, 'position' => 2]);
    $foreign = PokerTask::factory()->create();

    $taskIds = match ($case) {
        'missing' => [$second->id],
        'foreign' => [$second->id, $first->id, $foreign->id],
        'duplicate' => [$second->id, $second->id, $first->id],
        'replaced' => [$second->id, $foreign->id],
    };

    $this->actingAs($facilitator)
        ->putJson(route('poker.task-order.update', $game), ['task_ids' => $taskIds])
        ->assertUnprocessable();

    expect($game->tasks()->pluck('id')->all())->toBe([$first->id, $second->id]);
    Event::assertNotDispatched(PokerTasksReordered::class);
})->with(['missing', 'foreign', 'duplicate', 'replaced']);

it('ignores client-sent external fields', function () {
    [$game, $facilitator] = pokerTasksSetup();

    $response = $this->actingAs($facilitator)
        ->postJson(route('poker.tasks.store', $game), [
            'title' => 'Imported?',
            'external_source' => 'jira',
            'external_id' => 'SK-1',
            'external_url' => 'https://evil.example/SK-1',
        ])
        ->assertCreated()
        ->assertJsonPath('external', null);

    $task = PokerTask::query()->findOrFail($response->json('id'));

    $this->actingAs($facilitator)
        ->patchJson(route('poker.tasks.update', [$game, $task]), ['external_id' => 'SK-2'])
        ->assertOk();

    expect($task->fresh()->only(['external_source', 'external_id', 'external_url']))
        ->toBe(['external_source' => null, 'external_id' => null, 'external_url' => null]);
});

it('refuses changes on an ended game', function () {
    [$game, $facilitator] = pokerTasksSetup();
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id]);
    $game->update(['ended_at' => now()]);

    $this->actingAs($facilitator)
        ->postJson(route('poker.tasks.store', $game), ['title' => 'Late'])
        ->assertForbidden()
        ->assertJsonPath('message', 'This game has ended.');
    $this->actingAs($facilitator)->patchJson(route('poker.tasks.update', [$game, $task]), ['title' => 'Late'])->assertForbidden();
    $this->actingAs($facilitator)->deleteJson(route('poker.tasks.destroy', [$game, $task]))->assertForbidden();
    $this->actingAs($facilitator)
        ->putJson(route('poker.task-order.update', $game), ['task_ids' => [$task->id]])
        ->assertForbidden();
});

it('broadcasts task events to others', function () {
    [$game, $facilitator] = pokerTasksSetup();

    $taskId = $this->actingAs($facilitator)
        ->postJson(route('poker.tasks.store', $game), ['title' => 'Broadcast me'])
        ->json('id');
    $other = PokerTask::factory()->create(['poker_game_id' => $game->id, 'position' => 2]);

    $this->actingAs($facilitator)
        ->putJson(route('poker.task-order.update', $game), ['task_ids' => [$other->id, $taskId]])
        ->assertNoContent();

    Event::assertDispatched(PokerTaskSaved::class, fn (PokerTaskSaved $event) => $event->gameId === $game->id
        && $event->broadcastWith()['task']['id'] === $taskId
        && $event->broadcastWith()['task']['title'] === 'Broadcast me');
    Event::assertDispatched(PokerTasksReordered::class, fn (PokerTasksReordered $event) => $event->broadcastWith() === ['taskIds' => [$other->id, $taskId]]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerTasksTest.php`
Expected: FAIL — `Route [poker.tasks.store] not defined.`

- [ ] **Step 3: The add action**

Create `app/Actions/Poker/AddPokerTask.php`:

```php
<?php

namespace App\Actions\Poker;

use App\Events\Poker\PokerTaskSaved;
use App\Models\PokerGame;
use App\Models\PokerTask;
use Illuminate\Validation\ValidationException;

class AddPokerTask
{
    public const MaxTasks = 200;

    public function __construct(private PresentPokerTask $presentPokerTask) {}

    public function handle(PokerGame $locked, string $title, ?string $description): PokerTask
    {
        if ($locked->tasks()->count() >= self::MaxTasks) {
            throw ValidationException::withMessages(['title' => __('This game already has 200 tasks.')]);
        }

        $task = $locked->tasks()->create([
            'title' => $title,
            'description' => $description,
            'position' => (int) $locked->tasks()->max('position') + 1,
        ]);

        $task->loadCount('rounds');

        (new PokerTaskSaved($locked->id, $this->presentPokerTask->handle($task)))->sendToOthers();

        return $task;
    }
}
```

- [ ] **Step 4: The task controllers**

Create `app/Http/Controllers/Poker/PokerTasksController.php`:

```php
<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\AddPokerTask;
use App\Actions\Poker\PokerGuard;
use App\Actions\Poker\PresentPokerTask;
use App\Events\Poker\PokerTaskDeleted;
use App\Events\Poker\PokerTaskSaved;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class PokerTasksController extends Controller
{
    public function __construct(private PresentPokerTask $presentPokerTask) {}

    public function store(Request $request, PokerGame $game, AddPokerTask $addPokerTask): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::canEditTasks($player);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:10000'],
        ]);

        $task = DB::transaction(function () use ($game, $validated, $addPokerTask): PokerTask {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);

            return $addPokerTask->handle($locked, $validated['title'], $validated['description'] ?? null);
        });

        return response()->json($this->presentPokerTask->handle($task), 201);
    }

    public function update(Request $request, PokerGame $game, PokerTask $task): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::canEditTasks($player);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:200'],
            'description' => ['sometimes', 'nullable', 'string', 'max:10000'],
        ]);

        $task = DB::transaction(function () use ($game, $task, $validated): PokerTask {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);

            $lockedTask = PokerTask::query()->where('poker_game_id', $locked->id)->whereKey($task->id)->firstOrFail();

            $lockedTask->update($validated);
            $lockedTask->loadCount('rounds');

            (new PokerTaskSaved($locked->id, $this->presentPokerTask->handle($lockedTask)))->sendToOthers();

            return $lockedTask;
        });

        return response()->json($this->presentPokerTask->handle($task));
    }

    public function destroy(Request $request, PokerGame $game, PokerTask $task): Response
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::facilitator($game, $player);

        DB::transaction(function () use ($game, $task, $player): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);

            $lockedTask = PokerTask::query()->where('poker_game_id', $locked->id)->whereKey($task->id)->firstOrFail();
            $taskId = $lockedTask->id;

            $lockedTask->delete();

            (new PokerTaskDeleted($locked->id, $taskId))->sendToOthers();
        });

        return response()->noContent();
    }
}
```

Deleting the task cascades to its rounds and votes, and the `current_task_id` foreign key (`nullOnDelete`) clears the current task; clients drop it on `task.deleted`.

Create `app/Http/Controllers/Poker/PokerTaskOrdersController.php`:

```php
<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PokerGuard;
use App\Events\Poker\PokerTasksReordered;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PokerTaskOrdersController extends Controller
{
    public function update(Request $request, PokerGame $game): Response
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::facilitator($game, $player);

        /** @var array{task_ids: array<int, string>} $validated */
        $validated = $request->validate([
            'task_ids' => ['required', 'array'],
            'task_ids.*' => ['required', 'uuid', 'distinct'],
        ]);

        DB::transaction(function () use ($game, $player, $validated): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);

            $currentIds = PokerTask::query()->where('poker_game_id', $locked->id)->pluck('id')->sort()->values()->all();
            $givenIds = collect($validated['task_ids'])->sort()->values()->all();

            if ($currentIds !== $givenIds) {
                throw ValidationException::withMessages(['task_ids' => __('The list of tasks is out of date.')]);
            }

            foreach ($validated['task_ids'] as $index => $taskId) {
                PokerTask::query()->whereKey($taskId)->update(['position' => $index + 1]);
            }

            $locked->touch();

            (new PokerTasksReordered($locked->id, $validated['task_ids']))->sendToOthers();
        });

        return response()->noContent();
    }
}
```

- [ ] **Step 5: Routes**

In `routes/web.php` add `use App\Http\Controllers\Poker\PokerTaskOrdersController;` and `use App\Http\Controllers\Poker\PokerTasksController;`, then inside the `poker/{game}` group after the `snapshot` line:

```php
        Route::post('tasks', [PokerTasksController::class, 'store'])->name('poker.tasks.store');
        Route::patch('tasks/{task}', [PokerTasksController::class, 'update'])->name('poker.tasks.update')->whereUuid('task');
        Route::delete('tasks/{task}', [PokerTasksController::class, 'destroy'])->name('poker.tasks.destroy')->whereUuid('task');
        Route::put('task-order', [PokerTaskOrdersController::class, 'update'])->name('poker.task-order.update');
```

Run: `vendor/bin/sail artisan wayfinder:generate --with-form`

- [ ] **Step 6: Translations**

Append to `lang/en.json`:

```json
    "This game already has 200 tasks.": "This game already has 200 tasks.",
    "The list of tasks is out of date.": "The list of tasks is out of date."
```

`lang/fr.json`:

```json
    "This game already has 200 tasks.": "Cette partie compte déjà 200 tâches.",
    "The list of tasks is out of date.": "La liste des tâches n'est plus à jour."
```

`lang/es.json`:

```json
    "This game already has 200 tasks.": "Esta partida ya tiene 200 tareas.",
    "The list of tasks is out of date.": "La lista de tareas está desactualizada."
```

`lang/de.json`:

```json
    "This game already has 200 tasks.": "Dieses Spiel hat bereits 200 Aufgaben.",
    "The list of tasks is out of date.": "Die Aufgabenliste ist nicht mehr aktuell."
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerTasksTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 8: Format and analyse**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add app/Actions/Poker/AddPokerTask.php app/Http/Controllers/Poker/PokerTasksController.php app/Http/Controllers/Poker/PokerTaskOrdersController.php routes/web.php lang/en.json lang/fr.json lang/es.json lang/de.json tests/Feature/Poker/PokerTasksTest.php
git commit -m "feat: add, edit, delete and reorder poker tasks

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

### Task 8: Selecting a task and voting (`SelectPokerTask`, `StartPokerRound`, `PlayPokerCard`)

**Files:**
- Create: `app/Actions/Poker/{SelectPokerTask,StartPokerRound,PlayPokerCard}.php`, `app/Http/Controllers/Poker/PokerCurrentTasksController.php`, `app/Http/Controllers/Poker/PokerVotesController.php`
- Modify: `routes/web.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Poker/PokerVotingTest.php`

**Interfaces:**
- Consumes: `PokerGuard::{notEnded, facilitator, canVote, openRound}` (Task 5), `PokerVoteChanged`, `PokerRoundChanged` (Task 4), `PokerGame::latestRoundOfCurrentTask()`, `PokerRound::isRevealed()`, Pest helpers `pokerFacilitator`, `pokerMember`, `pokerGuest`, `pokerGuestCookie`, `openPokerRound`, `pokerVote`, factory state `PokerGameFactory::deck(PokerDeck)` (Task 2).
- Produces:
  - `StartPokerRound::handle(PokerGame $locked, PokerTask $task): PokerRound` — number = max + 1, `anonymous` copied from `$locked->anonymous_votes`, no timer.
  - `SelectPokerTask::handle(PokerGame $locked, ?PokerTask $task): void` — sets `current_task_id`; a task without rounds gets round 1; broadcasts `PokerRoundChanged`.
  - `PlayPokerCard::handle(PokerGame $game, PokerRound $round, PokerPlayer $player, ?string $value): array{roundId: string, myVote: ?string, votesCount: int, version: int, revealed: bool}` — `revealed` is always `false` here (Plan 10b fills it from the auto-reveal check in the controller).
  - `PokerCurrentTasksController::update` (204), `PokerVotesController::{update, destroy}` (200 with the `PlayPokerCard` array).
  - Routes `poker.current-task.update`, `poker.rounds.vote.update`, `poker.rounds.vote.destroy`.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Poker/PokerVotingTest.php`:

```php
<?php

use App\Enums\PokerDeck;
use App\Events\Poker\PokerRoundChanged;
use App\Events\Poker\PokerVoteChanged;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\PokerVote;
use App\Models\User;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array{
 *     game: PokerGame,
 *     round: PokerRound,
 *     facilitator: User,
 *     facilitatorPlayer: PokerPlayer,
 *     member: User,
 *     memberPlayer: PokerPlayer
 * }
 */
function pokerVotingSetup(PokerDeck $deck = PokerDeck::Fibonacci): array
{
    $game = PokerGame::factory()->deck($deck)->withGuestAccess()->create();
    [$facilitator, $facilitatorPlayer] = pokerFacilitator($game);
    [$member, $memberPlayer] = pokerMember($game);

    return [
        'game' => $game,
        'round' => openPokerRound($game),
        'facilitator' => $facilitator,
        'facilitatorPlayer' => $facilitatorPlayer,
        'member' => $member,
        'memberPlayer' => $memberPlayer,
    ];
}

function castPokerVote(mixed $test, User $user, PokerGame $game, PokerRound $round, string $value): mixed
{
    return $test->actingAs($user)->putJson(route('poker.rounds.vote.update', [$game, $round]), ['value' => $value]);
}

it('creates round 1 when a task is first selected', function () {
    $game = PokerGame::factory()->create();
    [$facilitator] = pokerFacilitator($game);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id]);

    $this->actingAs($facilitator)
        ->putJson(route('poker.current-task.update', $game), ['task_id' => $task->id])
        ->assertNoContent();

    $round = $task->rounds()->sole();

    expect($game->fresh()->current_task_id)->toBe($task->id)
        ->and($round->number)->toBe(1)
        ->and($round->isRevealed())->toBeFalse()
        ->and($round->timer_ends_at)->toBeNull();
    Event::assertDispatched(PokerRoundChanged::class, fn (PokerRoundChanged $event) => $event->gameId === $game->id);
});

it('copies anonymous votes into round 1', function () {
    $game = PokerGame::factory()->create(['anonymous_votes' => true]);
    [$facilitator] = pokerFacilitator($game);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id]);

    $this->actingAs($facilitator)
        ->putJson(route('poker.current-task.update', $game), ['task_id' => $task->id])
        ->assertNoContent();

    expect($task->rounds()->sole()->anonymous)->toBeTrue();
});

it('resumes an open round with its hidden votes', function () {
    ['game' => $game, 'round' => $round, 'facilitator' => $facilitator, 'memberPlayer' => $memberPlayer] = pokerVotingSetup();
    pokerVote($round, $memberPlayer, '8');
    $other = PokerTask::factory()->create(['poker_game_id' => $game->id]);

    $this->actingAs($facilitator)->putJson(route('poker.current-task.update', $game), ['task_id' => $other->id])->assertNoContent();
    $this->actingAs($facilitator)->putJson(route('poker.current-task.update', $game), ['task_id' => $round->poker_task_id])->assertNoContent();

    expect($round->task->rounds()->count())->toBe(1)
        ->and($round->votes()->sole()->value)->toBe('8')
        ->and($game->fresh()->latestRoundOfCurrentTask()?->id)->toBe($round->id);
});

it('clears the current task', function () {
    ['game' => $game, 'facilitator' => $facilitator] = pokerVotingSetup();

    $this->actingAs($facilitator)->putJson(route('poker.current-task.update', $game), ['task_id' => null])->assertNoContent();

    expect($game->fresh()->current_task_id)->toBeNull();
});

it('refuses tasks of another game', function () {
    ['game' => $game, 'facilitator' => $facilitator] = pokerVotingSetup();
    $foreign = PokerTask::factory()->create();

    $this->actingAs($facilitator)
        ->putJson(route('poker.current-task.update', $game), ['task_id' => $foreign->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('task_id');
});

it('lets only the facilitator select', function () {
    ['game' => $game, 'member' => $member] = pokerVotingSetup();
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id]);

    $this->actingAs($member)
        ->putJson(route('poker.current-task.update', $game), ['task_id' => $task->id])
        ->assertForbidden()
        ->assertJsonPath('message', 'Only the facilitator can do this.');

    expect($task->rounds()->count())->toBe(0);
});

it('votes, replaces and withdraws', function () {
    ['game' => $game, 'round' => $round, 'member' => $member, 'memberPlayer' => $memberPlayer] = pokerVotingSetup();

    castPokerVote($this, $member, $game, $round, '5')
        ->assertOk()
        ->assertExactJson(['roundId' => $round->id, 'myVote' => '5', 'votesCount' => 1, 'version' => 1, 'revealed' => false]);

    castPokerVote($this, $member, $game, $round, '8')
        ->assertOk()
        ->assertJsonPath('myVote', '8')
        ->assertJsonPath('votesCount', 1)
        ->assertJsonPath('version', 2);

    expect($round->votes()->sole()->only(['poker_player_id', 'value']))
        ->toBe(['poker_player_id' => $memberPlayer->id, 'value' => '8']);

    $this->actingAs($member)
        ->deleteJson(route('poker.rounds.vote.destroy', [$game, $round]))
        ->assertOk()
        ->assertExactJson(['roundId' => $round->id, 'myVote' => null, 'votesCount' => 0, 'version' => 3, 'revealed' => false]);

    expect($round->votes()->count())->toBe(0);
});

it('accepts ½ and ☕ where the deck has them', function (string $value) {
    ['game' => $game, 'round' => $round, 'member' => $member] = pokerVotingSetup(PokerDeck::ModifiedFibonacci);

    castPokerVote($this, $member, $game, $round, $value)->assertOk()->assertJsonPath('myVote', $value);
})->with(['½', '☕', '?', '100']);

it('refuses values outside the deck', function (PokerDeck $deck, string $value) {
    ['game' => $game, 'round' => $round, 'member' => $member] = pokerVotingSetup($deck);

    castPokerVote($this, $member, $game, $round, $value)
        ->assertUnprocessable()
        ->assertJsonPath('errors.value.0', 'Choose a card from the deck.');

    expect($round->votes()->count())->toBe(0);
})->with([
    'not fibonacci' => [PokerDeck::Fibonacci, '4'],
    'half outside modified' => [PokerDeck::Fibonacci, '½'],
    'number in t-shirt' => [PokerDeck::Tshirt, '5'],
    'lowercase size' => [PokerDeck::Tshirt, 'm'],
]);

it('requires a value', function () {
    ['game' => $game, 'round' => $round, 'member' => $member] = pokerVotingSetup();

    $this->actingAs($member)
        ->putJson(route('poker.rounds.vote.update', [$game, $round]), [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('value');
});

it('refuses votes on closed, older or non-current rounds', function (string $case) {
    ['game' => $game, 'round' => $round, 'member' => $member] = pokerVotingSetup();

    $target = match ($case) {
        'revealed' => tap($round)->update(['revealed_at' => now()]),
        'older' => tap($round, function (PokerRound $round): void {
            $round->update(['revealed_at' => now()]);
            PokerRound::factory()->create(['poker_task_id' => $round->poker_task_id, 'number' => 2]);
        }),
        'not current' => PokerRound::factory()->create([
            'poker_task_id' => PokerTask::factory()->create(['poker_game_id' => $game->id])->id,
        ]),
    };

    castPokerVote($this, $member, $game, $target, '5')
        ->assertUnprocessable()
        ->assertJsonPath('errors.votes.0', 'Voting is closed for this round.');

    expect($target->votes()->count())->toBe(0);
})->with(['revealed', 'older', 'not current']);

it('ignores a playerId in the body', function () {
    ['game' => $game, 'round' => $round, 'facilitator' => $facilitator, 'facilitatorPlayer' => $facilitatorPlayer, 'memberPlayer' => $memberPlayer] = pokerVotingSetup();

    $this->actingAs($facilitator)
        ->putJson(route('poker.rounds.vote.update', [$game, $round]), [
            'value' => '13',
            'playerId' => $memberPlayer->id,
            'player_id' => $memberPlayer->id,
            'poker_player_id' => $memberPlayer->id,
        ])
        ->assertOk();

    expect($round->votes()->sole()->poker_player_id)->toBe($facilitatorPlayer->id);
});

it('lets guests and the facilitator vote', function () {
    ['game' => $game, 'round' => $round, 'facilitator' => $facilitator] = pokerVotingSetup();
    $guest = pokerGuest($game);

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->putJson(route('poker.rounds.vote.update', [$game, $round]), ['value' => '3'])
        ->assertOk()
        ->assertJsonPath('myVote', '3');

    castPokerVote($this, $facilitator, $game, $round, '5')
        ->assertOk()
        ->assertJsonPath('votesCount', 2);
});

it('refuses votes on an ended game', function () {
    ['game' => $game, 'round' => $round, 'member' => $member] = pokerVotingSetup();
    $game->update(['ended_at' => now()]);

    castPokerVote($this, $member, $game, $round, '5')
        ->assertForbidden()
        ->assertJsonPath('message', 'This game has ended.');
    $this->actingAs($member)->deleteJson(route('poker.rounds.vote.destroy', [$game, $round]))->assertForbidden();
});

it('refuses spectators', function () {
    ['game' => $game, 'round' => $round, 'member' => $member, 'memberPlayer' => $memberPlayer] = pokerVotingSetup();
    $memberPlayer->update(['is_spectator' => true]);

    castPokerVote($this, $member, $game, $round, '5')
        ->assertForbidden()
        ->assertJsonPath('message', "Spectators can't vote.");

    expect($round->votes()->count())->toBe(0);
});

it('refuses a vote after a concurrent reveal', function () {
    ['game' => $game, 'round' => $round, 'member' => $member, 'facilitatorPlayer' => $facilitatorPlayer] = pokerVotingSetup();
    pokerVote($round, $facilitatorPlayer, '3');
    PokerRound::query()->whereKey($round->id)->update(['revealed_at' => now()]);

    castPokerVote($this, $member, $game, $round, '5')->assertUnprocessable();

    expect($round->votes()->count())->toBe(1);
});

it('answers 404 for a round of a deleted task', function () {
    ['game' => $game, 'round' => $round, 'member' => $member] = pokerVotingSetup();
    $round->task->delete();

    castPokerVote($this, $member, $game, $round, '5')->assertNotFound();
});

it('answers 404 for a round of another game', function () {
    ['game' => $game, 'member' => $member] = pokerVotingSetup();
    $foreign = openPokerRound(PokerGame::factory()->create());

    castPokerVote($this, $member, $game, $foreign, '5')->assertNotFound();
});

it('broadcasts vote changes without values', function () {
    ['game' => $game, 'round' => $round, 'member' => $member, 'memberPlayer' => $memberPlayer] = pokerVotingSetup();

    castPokerVote($this, $member, $game, $round, '13')->assertOk();
    $this->actingAs($member)->deleteJson(route('poker.rounds.vote.destroy', [$game, $round]))->assertOk();

    Event::assertDispatched(PokerVoteChanged::class, fn (PokerVoteChanged $event) => $event->broadcastWith() === [
        'roundId' => $round->id,
        'playerId' => $memberPlayer->id,
        'hasVoted' => true,
        'votesCount' => 1,
        'version' => 1,
    ]);
    Event::assertDispatched(PokerVoteChanged::class, fn (PokerVoteChanged $event) => $event->broadcastWith() === [
        'roundId' => $round->id,
        'playerId' => $memberPlayer->id,
        'hasVoted' => false,
        'votesCount' => 0,
        'version' => 2,
    ]);
    Event::assertNotDispatched(PokerVoteChanged::class, fn (PokerVoteChanged $event) => str_contains((string) json_encode($event->broadcastWith()), '"13"'));
});

it('increments the version on every change', function () {
    ['game' => $game, 'round' => $round, 'member' => $member] = pokerVotingSetup();

    castPokerVote($this, $member, $game, $round, '5')->assertJsonPath('version', 1);
    castPokerVote($this, $member, $game, $round, '5')->assertJsonPath('version', 1);
    castPokerVote($this, $member, $game, $round, '8')->assertJsonPath('version', 2);
    $this->actingAs($member)->deleteJson(route('poker.rounds.vote.destroy', [$game, $round]))->assertJsonPath('version', 3);
    $this->actingAs($member)->deleteJson(route('poker.rounds.vote.destroy', [$game, $round]))->assertJsonPath('version', 3);

    expect($round->fresh()->version)->toBe(3)
        ->and(PokerVote::query()->count())->toBe(0);
    Event::assertDispatched(PokerVoteChanged::class, 3);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerVotingTest.php`
Expected: FAIL — `Route [poker.current-task.update] not defined.`

- [ ] **Step 3: Rounds and selection**

Create `app/Actions/Poker/StartPokerRound.php`:

```php
<?php

namespace App\Actions\Poker;

use App\Models\PokerGame;
use App\Models\PokerRound;
use App\Models\PokerTask;

class StartPokerRound
{
    public function handle(PokerGame $locked, PokerTask $task): PokerRound
    {
        return $task->rounds()->create([
            'number' => (int) $task->rounds()->max('number') + 1,
            'anonymous' => $locked->anonymous_votes,
        ]);
    }
}
```

Create `app/Actions/Poker/SelectPokerTask.php`:

```php
<?php

namespace App\Actions\Poker;

use App\Events\Poker\PokerRoundChanged;
use App\Models\PokerGame;
use App\Models\PokerTask;

class SelectPokerTask
{
    public function __construct(private StartPokerRound $startPokerRound) {}

    /**
     * Selecting a task never discards anything: an open round resumes with
     * its hidden votes, a revealed one is shown until the facilitator re-votes.
     */
    public function handle(PokerGame $locked, ?PokerTask $task): void
    {
        $locked->update(['current_task_id' => $task?->id]);

        if ($task !== null && ! $task->rounds()->exists()) {
            $this->startPokerRound->handle($locked, $task);
        }

        (new PokerRoundChanged($locked->id))->sendToOthers();
    }
}
```

Create `app/Http/Controllers/Poker/PokerCurrentTasksController.php`:

```php
<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PokerGuard;
use App\Actions\Poker\SelectPokerTask;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PokerCurrentTasksController extends Controller
{
    public function update(Request $request, PokerGame $game, SelectPokerTask $selectPokerTask): Response
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::facilitator($game, $player);

        $validated = $request->validate([
            'task_id' => ['present', 'nullable', 'uuid', Rule::exists('poker_tasks', 'id')->where('poker_game_id', $game->id)],
        ]);

        DB::transaction(function () use ($game, $player, $validated, $selectPokerTask): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);

            $task = $validated['task_id'] === null
                ? null
                : PokerTask::query()->where('poker_game_id', $locked->id)->whereKey($validated['task_id'])->firstOrFail();

            $selectPokerTask->handle($locked, $task);
        });

        return response()->noContent();
    }
}
```

- [ ] **Step 4: Playing a card**

Create `app/Actions/Poker/PlayPokerCard.php`:

```php
<?php

namespace App\Actions\Poker;

use App\Events\Poker\PokerVoteChanged;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PlayPokerCard
{
    /**
     * Plays `$value` for `$player` (the requester — never anyone else), or
     * withdraws their card when `$value` is null.
     *
     * @return array{
     *     roundId: string,
     *     myVote: ?string,
     *     votesCount: int,
     *     version: int,
     *     revealed: bool
     * }
     */
    public function handle(PokerGame $game, PokerRound $round, PokerPlayer $player, ?string $value): array
    {
        return DB::transaction(function () use ($game, $round, $player, $value): array {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();
            $lockedRound = PokerRound::query()->whereKey($round->id)->lockForUpdate()->firstOrFail();
            $lockedPlayer = PokerPlayer::query()->whereKey($player->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::canVote($lockedPlayer);
            PokerGuard::openRound($locked, $lockedRound);

            if ($value !== null && ! in_array($value, $locked->cards, true)) {
                throw ValidationException::withMessages(['value' => __('Choose a card from the deck.')]);
            }

            $vote = $lockedRound->votes()->where('poker_player_id', $lockedPlayer->id)->first();
            $changed = $vote?->value !== $value;

            if ($changed && $value === null) {
                $vote?->delete();
            }

            if ($changed && $value !== null && $vote === null) {
                $lockedRound->votes()->create(['poker_player_id' => $lockedPlayer->id, 'value' => $value]);
            }

            if ($changed && $value !== null && $vote !== null) {
                $vote->update(['value' => $value]);
            }

            if ($changed) {
                $lockedRound->increment('version');
            }

            $votesCount = $lockedRound->votes()->count();

            if ($changed) {
                (new PokerVoteChanged(
                    $locked->id,
                    $lockedRound->id,
                    $lockedPlayer->id,
                    $value !== null,
                    $votesCount,
                    $lockedRound->version,
                ))->sendToOthers();
            }

            return [
                'roundId' => $lockedRound->id,
                'myVote' => $value,
                'votesCount' => $votesCount,
                'version' => $lockedRound->version,
                'revealed' => false,
            ];
        });
    }
}
```

`$vote?->value !== $value` is `false` exactly when nothing would change (same card again, or withdrawing without a card), so the version and the broadcast only move on real changes.

Create `app/Http/Controllers/Poker/PokerVotesController.php`:

```php
<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PlayPokerCard;
use App\Actions\Poker\PokerGuard;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PokerVotesController extends Controller
{
    public function update(Request $request, PokerGame $game, PokerRound $round, PlayPokerCard $playPokerCard): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::canVote($player);

        $validated = $request->validate([
            'value' => ['required', 'string', 'max:8'],
        ]);

        return response()->json($playPokerCard->handle($game, $round, $player, $validated['value']));
    }

    public function destroy(Request $request, PokerGame $game, PokerRound $round, PlayPokerCard $playPokerCard): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::canVote($player);

        return response()->json($playPokerCard->handle($game, $round, $player, null));
    }
}
```

- [ ] **Step 5: Routes**

In `routes/web.php` add `use App\Http\Controllers\Poker\PokerCurrentTasksController;` and `use App\Http\Controllers\Poker\PokerVotesController;`, then inside the `poker/{game}` group after the `task-order` line:

```php
        Route::put('current-task', [PokerCurrentTasksController::class, 'update'])->name('poker.current-task.update');
        Route::put('rounds/{round}/vote', [PokerVotesController::class, 'update'])->name('poker.rounds.vote.update')->whereUuid('round');
        Route::delete('rounds/{round}/vote', [PokerVotesController::class, 'destroy'])->name('poker.rounds.vote.destroy')->whereUuid('round');
```

`{round}` resolves through `PokerGame::rounds()` (HasManyThrough), so a round of another game — or of a task deleted meanwhile — is a 404.

Run: `vendor/bin/sail artisan wayfinder:generate --with-form`

- [ ] **Step 6: Translations**

Append to `lang/en.json`:

```json
    "Choose a card from the deck.": "Choose a card from the deck."
```

`lang/fr.json`:

```json
    "Choose a card from the deck.": "Choisissez une carte du jeu."
```

`lang/es.json`:

```json
    "Choose a card from the deck.": "Elige una carta de la baraja."
```

`lang/de.json`:

```json
    "Choose a card from the deck.": "Wähle eine Karte aus dem Deck."
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerVotingTest.php tests/Feature/Poker/PokerTasksTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 8: Format and analyse**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add app/Actions/Poker/StartPokerRound.php app/Actions/Poker/SelectPokerTask.php app/Actions/Poker/PlayPokerCard.php app/Http/Controllers/Poker/PokerCurrentTasksController.php app/Http/Controllers/Poker/PokerVotesController.php routes/web.php lang/en.json lang/fr.json lang/es.json lang/de.json tests/Feature/Poker/PokerVotingTest.php
git commit -m "feat: select poker tasks and play hidden cards

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

#### Implementer notes

- The "refuses a vote after a concurrent reveal" and "refuses spectators" tests change rows directly in the database; both rely on `PlayPokerCard` re-reading the game, round **and player** under `lockForUpdate` (the route-bound and middleware-resolved models are stale by design). Plan 10b's spectator race test depends on the same re-read.

### Task 9: Reveal, re-vote, estimate and round history

**Files:**
- Create: `app/Actions/Poker/RevealPokerRound.php`, `app/Actions/Poker/SetPokerEstimate.php`, `app/Http/Controllers/Poker/PokerRevealsController.php`, `app/Http/Controllers/Poker/PokerRoundsController.php`, `app/Http/Controllers/Poker/PokerTaskEstimatesController.php`
- Modify: `routes/web.php`, `tests/Pest.php` (helper `pokerRevealTable`), `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Poker/PokerRevealTest.php`, `tests/Feature/Poker/PokerEstimateTest.php`, `tests/Feature/Poker/PokerRoundHistoryTest.php`

**Interfaces:**
- Consumes: `PokerGuard::{notEnded, facilitator, openRound}` (Task 5), `StartPokerRound::handle(PokerGame $locked, PokerTask $task): PokerRound` (Task 8, does not broadcast), `PresentPokerRound::handle(PokerRound $round, PokerGame $game, ?string $viewerPlayerId, bool $listUnrevealedVoters = true)` (needs `$round->votes` and `$game->players` loaded), `PresentPokerTask::handle(PokerTask $task)`, `PokerDeck::{isSpecial, numericValue}`, events `PokerRoundChanged`, `PokerTaskSaved`, `PokerTaskEstimated` (Task 4), Pest helpers `pokerFacilitator`, `pokerMember`, `pokerGuest`, `pokerGuestCookie`, `openPokerRound`, `pokerVote` (Task 2).
- Produces:
  - `RevealPokerRound::handle(PokerGame $locked, PokerRound $lockedRound, PokerRevealReason $reason): void` — `PokerGuard::openRound`; ≥ 1 vote else 422 `round` "Nobody has voted yet."; sets `revealed_at`, `reveal_reason`; broadcasts `PokerRoundChanged`.
  - `PokerRevealsController::store` → 200 `{round: PresentPokerRound payload for the viewer}`.
  - `PokerRoundsController::store` (re-vote) → 201 `{round: …}`; `PokerRoundsController::index` → 200 `{rounds: […]}` newest first, `$listUnrevealedVoters = false`.
  - `SetPokerEstimate::handle(PokerGame $locked, PokerTask $task, ?string $value): PokerTask` — as outlined; `estimated_at` only moves when the value changes.
  - `PokerTaskEstimatesController::update` → 200 `{task: PresentPokerTask payload}`.
  - Pest helper `pokerRevealTable(PokerDeck $deck = PokerDeck::Fibonacci): array{game: PokerGame, facilitator: User, facilitatorPlayer: PokerPlayer, member: User, memberPlayer: PokerPlayer, round: PokerRound}` (open round 1 of the current task).

- [ ] **Step 1: Pest helper**

In `tests/Pest.php` add `use App\Enums\PokerDeck;`, `use App\Models\PokerGame;`, `use App\Models\PokerPlayer;`, `use App\Models\PokerRound;` to the imports if Task 2 did not already, and append:

```php
/**
 * @return array{
 *     game: PokerGame,
 *     facilitator: User,
 *     facilitatorPlayer: PokerPlayer,
 *     member: User,
 *     memberPlayer: PokerPlayer,
 *     round: PokerRound
 * }
 */
function pokerRevealTable(PokerDeck $deck = PokerDeck::Fibonacci): array
{
    $game = PokerGame::factory()->deck($deck)->withGuestAccess()->create();
    [$facilitator, $facilitatorPlayer] = pokerFacilitator($game);
    [$member, $memberPlayer] = pokerMember($game);

    return [
        'game' => $game,
        'facilitator' => $facilitator,
        'facilitatorPlayer' => $facilitatorPlayer,
        'member' => $member,
        'memberPlayer' => $memberPlayer,
        'round' => openPokerRound($game),
    ];
}
```

- [ ] **Step 2: Write the failing reveal and re-vote tests**

Create `tests/Feature/Poker/PokerRevealTest.php`:

```php
<?php

use App\Enums\PokerRevealReason;
use App\Events\Poker\PokerRoundChanged;
use App\Models\PokerRound;
use App\Models\PokerTask;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('reveals as facilitator only', function () {
    $table = pokerRevealTable();
    pokerVote($table['round'], $table['memberPlayer'], '5');
    $url = route('poker.rounds.reveal.store', [$table['game'], $table['round']]);

    $this->actingAs($table['member'])->postJson($url)->assertForbidden();

    expect($table['round']->fresh()->revealed_at)->toBeNull();

    $this->actingAs($table['facilitator'])->postJson($url)
        ->assertOk()
        ->assertJsonPath('id', $table['round']->id)
        ->assertJsonPath('revealReason', 'manual');

    $round = $table['round']->fresh();

    expect($round->revealed_at)->not->toBeNull()
        ->and($round->reveal_reason)->toBe(PokerRevealReason::Manual);

    Event::assertDispatched(PokerRoundChanged::class, fn (PokerRoundChanged $event) => $event->gameId === $table['game']->id);
});

it('needs a vote to reveal', function () {
    $table = pokerRevealTable();

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.rounds.reveal.store', [$table['game'], $table['round']]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['round' => 'Nobody has voted yet.']);

    expect($table['round']->fresh()->revealed_at)->toBeNull();
    Event::assertNotDispatched(PokerRoundChanged::class);
});

it('reveals once', function () {
    $table = pokerRevealTable();
    pokerVote($table['round'], $table['memberPlayer'], '5');
    $url = route('poker.rounds.reveal.store', [$table['game'], $table['round']]);

    $this->actingAs($table['facilitator'])->postJson($url)->assertOk();

    $this->actingAs($table['facilitator'])->postJson($url)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['votes' => 'Voting is closed for this round.']);
});

it('answers the revealed round with every value', function () {
    $table = pokerRevealTable();
    pokerVote($table['round'], $table['facilitatorPlayer'], '5');
    pokerVote($table['round'], $table['memberPlayer'], '8');

    $response = $this->actingAs($table['facilitator'])
        ->postJson(route('poker.rounds.reveal.store', [$table['game'], $table['round']]))
        ->assertOk()
        ->assertJsonPath('votesCount', 2)
        ->assertJsonPath('myVote', '5')
        ->assertJsonPath('result.average', 6.5)
        ->assertJsonPath('result.nearestCard', '8')
        ->assertJsonPath('result.consensus', false);

    expect(collect($response->json('votes'))->pluck('value', 'playerId')->all())->toEqual([
        $table['facilitatorPlayer']->id => '5',
        $table['memberPlayer']->id => '8',
    ]);
});

it('starts a new round only after reveal and keeps old rounds', function () {
    $table = pokerRevealTable();
    $task = $table['round']->task;
    pokerVote($table['round'], $table['memberPlayer'], '5');
    $url = route('poker.tasks.rounds.store', [$table['game'], $task]);

    $this->actingAs($table['facilitator'])->postJson($url)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['task' => 'Reveal the votes before starting a new round.']);

    $table['round']->update(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual]);

    $this->actingAs($table['member'])->postJson($url)->assertForbidden();

    $this->actingAs($table['facilitator'])->postJson($url)
        ->assertCreated()
        ->assertJsonPath('number', 2)
        ->assertJsonPath('votesCount', 0)
        ->assertJsonPath('revealedAt', null)
        ->assertJsonPath('timerEndsAt', null);

    expect($task->rounds()->count())->toBe(2)
        ->and($table['round']->votes()->count())->toBe(1)
        ->and($table['game']->fresh()->latestRoundOfCurrentTask()?->number)->toBe(2);

    Event::assertDispatched(PokerRoundChanged::class);
});

it('refuses reveal, re-vote and estimate on tasks without a round or not current', function () {
    $table = pokerRevealTable();
    $game = $table['game'];
    $withoutRound = PokerTask::factory()->create(['poker_game_id' => $game->id]);

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.tasks.rounds.store', [$game, $withoutRound]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['task' => 'Select this task first.']);

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$game, $withoutRound]), ['value' => '5'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['value' => 'Reveal the votes before setting an estimate.']);

    $game->forceFill(['current_task_id' => $withoutRound->id])->save();

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.tasks.rounds.store', [$game, $withoutRound]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['task' => 'Reveal the votes before starting a new round.']);

    $elsewhere = PokerTask::factory()->create(['poker_game_id' => $game->id]);
    $openElsewhere = PokerRound::factory()->create(['poker_task_id' => $elsewhere->id]);
    pokerVote($openElsewhere, $table['memberPlayer'], '3');

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.rounds.reveal.store', [$game, $openElsewhere]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['votes' => 'Voting is closed for this round.']);

    $revealedElsewhere = PokerTask::factory()->create(['poker_game_id' => $game->id]);
    PokerRound::factory()->revealed()->create(['poker_task_id' => $revealedElsewhere->id]);

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.tasks.rounds.store', [$game, $revealedElsewhere]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['task' => 'Select this task first.']);

    expect($openElsewhere->fresh()->revealed_at)->toBeNull()
        ->and($revealedElsewhere->rounds()->count())->toBe(1)
        ->and($withoutRound->rounds()->count())->toBe(0)
        ->and($withoutRound->fresh()->estimate)->toBeNull();
});
```

- [ ] **Step 3: Write the failing estimate tests**

Create `tests/Feature/Poker/PokerEstimateTest.php`:

```php
<?php

use App\Enums\PokerDeck;
use App\Enums\PokerRevealReason;
use App\Events\Poker\PokerTaskEstimated;
use App\Events\Poker\PokerTaskSaved;
use App\Models\PokerTask;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array<string, mixed>
 */
function estimateReadyTable(PokerDeck $deck, string $facilitatorValue, string $memberValue): array
{
    $table = pokerRevealTable($deck);
    pokerVote($table['round'], $table['facilitatorPlayer'], $facilitatorValue);
    pokerVote($table['round'], $table['memberPlayer'], $memberValue);
    $table['round']->update(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual]);
    $table['task'] = $table['round']->task;

    return $table;
}

it('sets the estimate after reveal', function () {
    $table = estimateReadyTable(PokerDeck::Fibonacci, '5', '8');
    $url = route('poker.tasks.estimate.update', [$table['game'], $table['task']]);

    $this->actingAs($table['member'])->putJson($url, ['value' => '8'])->assertForbidden();

    $this->actingAs($table['facilitator'])->putJson($url, ['value' => '8'])
        ->assertOk()
        ->assertJsonPath('id', $table['task']->id)
        ->assertJsonPath('estimate', '8');

    $task = $table['task']->fresh();

    expect($task->estimate)->toBe('8')
        ->and($task->estimate_numeric)->toBe(8.0)
        ->and($task->estimated_at)->not->toBeNull();

    Event::assertDispatched(PokerTaskSaved::class, fn (PokerTaskSaved $event) => $event->gameId === $table['game']->id
        && $event->task['estimate'] === '8');
});

it('rejects special and foreign cards as estimates', function (string $value) {
    $table = estimateReadyTable(PokerDeck::Fibonacci, '5', '8');

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $table['task']]), ['value' => $value])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['value' => 'Choose a card from the deck.']);

    expect($table['task']->fresh()->estimate)->toBeNull();
})->with(['?', '☕', '7', 'XL']);

it('needs a countable vote', function () {
    $table = estimateReadyTable(PokerDeck::Fibonacci, '?', '☕');

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $table['task']]), ['value' => '5'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['value' => 'Reveal the votes before setting an estimate.']);
});

it('needs a revealed latest round', function () {
    $table = pokerRevealTable();
    pokerVote($table['round'], $table['memberPlayer'], '5');

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $table['round']->task]), ['value' => '5'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['value' => 'Reveal the votes before setting an estimate.']);
});

it('clears the estimate at any time', function () {
    $table = pokerRevealTable();
    $task = PokerTask::factory()->estimated('5')->create(['poker_game_id' => $table['game']->id]);

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $task]), ['value' => null])
        ->assertOk()
        ->assertJsonPath('estimate', null)
        ->assertJsonPath('estimatedAt', null);

    $task->refresh();

    expect($task->estimate)->toBeNull()
        ->and($task->estimate_numeric)->toBeNull()
        ->and($task->estimated_at)->toBeNull();
});

it('stores no numeric estimate for T-shirt decks', function () {
    $table = estimateReadyTable(PokerDeck::Tshirt, 'M', 'L');

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $table['task']]), ['value' => 'M'])
        ->assertOk();

    expect($table['task']->fresh()->estimate_numeric)->toBeNull();
});

it('stores half a point for the modified Fibonacci ½ card', function () {
    $table = estimateReadyTable(PokerDeck::ModifiedFibonacci, '½', '1');

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$table['game'], $table['task']]), ['value' => '½'])
        ->assertOk();

    expect($table['task']->fresh()->estimate_numeric)->toBe(0.5);
});

it('dispatches PokerTaskEstimated only when a card is set or changed', function () {
    $table = estimateReadyTable(PokerDeck::Fibonacci, '5', '8');
    $url = route('poker.tasks.estimate.update', [$table['game'], $table['task']]);
    $this->actingAs($table['facilitator']);

    $this->putJson($url, ['value' => '?'])->assertUnprocessable();
    Event::assertNotDispatched(PokerTaskEstimated::class);

    $this->putJson($url, ['value' => '8'])->assertOk();
    Event::assertDispatchedTimes(PokerTaskEstimated::class, 1);

    $this->putJson($url, ['value' => '8'])->assertOk();
    Event::assertDispatchedTimes(PokerTaskEstimated::class, 1);

    $this->putJson($url, ['value' => '5'])->assertOk();
    Event::assertDispatchedTimes(PokerTaskEstimated::class, 2);

    $this->putJson($url, ['value' => null])->assertOk();
    Event::assertDispatchedTimes(PokerTaskEstimated::class, 2);

    Event::assertDispatched(PokerTaskEstimated::class, fn (PokerTaskEstimated $event) => $event->task->is($table['task']));
});
```

- [ ] **Step 4: Write the failing round history tests**

Create `tests/Feature/Poker/PokerRoundHistoryTest.php`:

```php
<?php

use App\Enums\PokerRevealReason;
use App\Models\PokerGame;
use App\Models\PokerRound;
use App\Models\PokerTask;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('lists rounds newest first with values only when revealed', function () {
    $table = pokerRevealTable();
    $task = $table['round']->task;
    pokerVote($table['round'], $table['facilitatorPlayer'], '5');
    pokerVote($table['round'], $table['memberPlayer'], '8');
    $table['round']->update(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual]);
    $open = PokerRound::factory()->create(['poker_task_id' => $task->id, 'number' => 2]);
    pokerVote($open, $table['facilitatorPlayer'], '13');
    pokerVote($open, $table['memberPlayer'], '3');
    $guest = pokerGuest($table['game']);

    $response = $this->actingAs($table['member'])
        ->getJson(route('poker.tasks.rounds.index', [$table['game'], $task]))
        ->assertOk()
        ->assertJsonCount(2)
        ->assertJsonPath('0.number', 2)
        ->assertJsonPath('0.votes', [])
        ->assertJsonPath('0.votesCount', 2)
        ->assertJsonPath('0.myVote', '3')
        ->assertJsonPath('0.result', null)
        ->assertJsonPath('1.number', 1)
        ->assertJsonPath('1.result.average', 6.5);

    expect(collect($response->json('1.votes'))->pluck('value', 'playerId')->all())->toEqual([
        $table['facilitatorPlayer']->id => '5',
        $table['memberPlayer']->id => '8',
    ])->and($response->getContent())->not->toContain('"13"');

    app('auth')->forgetGuards();

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->getJson(route('poker.tasks.rounds.index', [$table['game'], $task]))
        ->assertOk()
        ->assertJsonPath('0.votes', [])
        ->assertJsonPath('0.myVote', null);
});

it('keeps never-revealed rounds hidden forever', function () {
    $table = pokerRevealTable();
    $task = $table['round']->task;
    pokerVote($table['round'], $table['facilitatorPlayer'], '13');
    pokerVote($table['round'], $table['memberPlayer'], '21');

    $other = PokerTask::factory()->create(['poker_game_id' => $table['game']->id]);

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.current-task.update', $table['game']), ['task_id' => $other->id])
        ->assertNoContent();

    $response = $this->actingAs($table['facilitator'])
        ->getJson(route('poker.tasks.rounds.index', [$table['game'], $task]))
        ->assertOk()
        ->assertJsonPath('0.revealedAt', null)
        ->assertJsonPath('0.votes', [])
        ->assertJsonPath('0.votesCount', 2)
        ->assertJsonPath('0.myVote', '13');

    expect($response->getContent())->not->toContain('"21"');
});

it('loads the history with a constant number of queries', function () {
    $game = PokerGame::factory()->create();
    [$facilitator, $facilitatorPlayer] = pokerFacilitator($game);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id]);

    $addRounds = function (int $roundCount, int $playerCount) use ($game, $task, $facilitatorPlayer): void {
        $voters = collect([$facilitatorPlayer])
            ->merge(collect(range(1, $playerCount - 1))->map(fn () => pokerMember($game)[1]));
        $next = (int) $task->rounds()->max('number');

        foreach (range(1, $roundCount) as $offset) {
            $round = PokerRound::factory()->revealed()->create(['poker_task_id' => $task->id, 'number' => $next + $offset]);
            $voters->each(fn ($voter) => pokerVote($round, $voter, '5'));
        }
    };

    $countQueries = function () use ($facilitator, $game, $task): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->actingAs($facilitator)->getJson(route('poker.tasks.rounds.index', [$game, $task]))->assertOk();
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $addRounds(2, 2);
    $countQueries();
    $small = $countQueries();

    $addRounds(4, 4);

    expect($countQueries())->toBe($small);
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerRevealTest.php tests/Feature/Poker/PokerEstimateTest.php tests/Feature/Poker/PokerRoundHistoryTest.php`
Expected: FAIL — `Route [poker.rounds.reveal.store] not defined.` (and the same for `poker.tasks.rounds.*`, `poker.tasks.estimate.update`).

- [ ] **Step 6: `RevealPokerRound`**

Create `app/Actions/Poker/RevealPokerRound.php`:

```php
<?php

namespace App\Actions\Poker;

use App\Enums\PokerRevealReason;
use App\Events\Poker\PokerRoundChanged;
use App\Models\PokerGame;
use App\Models\PokerRound;
use Illuminate\Validation\ValidationException;

class RevealPokerRound
{
    public function handle(PokerGame $locked, PokerRound $lockedRound, PokerRevealReason $reason): void
    {
        PokerGuard::openRound($locked, $lockedRound);

        if (! $lockedRound->votes()->exists()) {
            throw ValidationException::withMessages(['round' => __('Nobody has voted yet.')]);
        }

        $lockedRound->update([
            'revealed_at' => now(),
            'reveal_reason' => $reason,
        ]);

        (new PokerRoundChanged($locked->id))->sendToOthers();
    }
}
```

- [ ] **Step 7: `SetPokerEstimate`**

Create `app/Actions/Poker/SetPokerEstimate.php`:

```php
<?php

namespace App\Actions\Poker;

use App\Enums\PokerDeck;
use App\Events\Poker\PokerTaskEstimated;
use App\Events\Poker\PokerTaskSaved;
use App\Models\PokerGame;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\PokerVote;
use Illuminate\Validation\ValidationException;

class SetPokerEstimate
{
    public function __construct(private PresentPokerTask $presentPokerTask) {}

    public function handle(PokerGame $locked, PokerTask $task, ?string $value): PokerTask
    {
        $previous = $task->estimate;

        if ($value === null) {
            $task->update([
                'estimate' => null,
                'estimate_numeric' => null,
                'estimated_at' => null,
            ]);
        }

        if ($value !== null) {
            $this->ensureEstimable($locked, $task, $value);

            if ($value !== $previous) {
                $task->update([
                    'estimate' => $value,
                    'estimate_numeric' => PokerDeck::numericValue($value),
                    'estimated_at' => now(),
                ]);
            }
        }

        $task->loadCount('rounds');

        (new PokerTaskSaved($locked->id, $this->presentPokerTask->handle($task)))->sendToOthers();

        if ($value !== null && $value !== $previous) {
            PokerTaskEstimated::dispatch($task);
        }

        return $task;
    }

    private function ensureEstimable(PokerGame $locked, PokerTask $task, string $value): void
    {
        if (! in_array($value, $locked->cards, true) || PokerDeck::isSpecial($value)) {
            throw ValidationException::withMessages(['value' => __('Choose a card from the deck.')]);
        }

        $latestRound = $task->latestRound()->with('votes')->first();

        if ($latestRound === null || ! $latestRound->isRevealed() || ! $this->hasCountableVote($latestRound)) {
            throw ValidationException::withMessages(['value' => __('Reveal the votes before setting an estimate.')]);
        }
    }

    private function hasCountableVote(PokerRound $round): bool
    {
        return $round->votes->contains(fn (PokerVote $vote): bool => ! PokerDeck::isSpecial($vote->value));
    }
}
```

- [ ] **Step 8: Controllers**

Create `app/Http/Controllers/Poker/PokerRevealsController.php`:

```php
<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PokerGuard;
use App\Actions\Poker\PresentPokerRound;
use App\Actions\Poker\RevealPokerRound;
use App\Enums\PokerRevealReason;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PokerRevealsController extends Controller
{
    public function store(Request $request, PokerGame $game, PokerRound $round, RevealPokerRound $revealPokerRound, PresentPokerRound $presentPokerRound): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::facilitator($game, $player);

        DB::transaction(function () use ($game, $round, $player, $revealPokerRound): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);

            $lockedRound = PokerRound::query()->whereKey($round->id)->lockForUpdate()->firstOrFail();

            $revealPokerRound->handle($locked, $lockedRound, PokerRevealReason::Manual);
        });

        return response()->json(
            $presentPokerRound->handle($round->refresh()->load('votes'), $game->load('players'), $player->id),
        );
    }
}
```

Create `app/Http/Controllers/Poker/PokerRoundsController.php`:

```php
<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PokerGuard;
use App\Actions\Poker\PresentPokerRound;
use App\Actions\Poker\StartPokerRound;
use App\Events\Poker\PokerRoundChanged;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PokerRoundsController extends Controller
{
    public function __construct(private PresentPokerRound $presentPokerRound) {}

    public function index(Request $request, PokerGame $game, PokerTask $task): JsonResponse
    {
        $player = PokerPlayer::current($request);

        $game->load('players');

        $rounds = $task->rounds()
            ->with('votes')
            ->reorder()
            ->orderByDesc('number')
            ->get();

        return response()->json(
            $rounds
                ->map(fn (PokerRound $round): array => $this->presentPokerRound->handle($round, $game, $player->id, listUnrevealedVoters: false))
                ->values(),
        );
    }

    public function store(Request $request, PokerGame $game, PokerTask $task, StartPokerRound $startPokerRound): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::facilitator($game, $player);

        $round = DB::transaction(function () use ($game, $task, $player, $startPokerRound): PokerRound {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);

            if ($locked->current_task_id !== $task->id) {
                throw ValidationException::withMessages(['task' => __('Select this task first.')]);
            }

            $latestRound = $task->latestRound()->first();

            if ($latestRound === null || ! $latestRound->isRevealed()) {
                throw ValidationException::withMessages(['task' => __('Reveal the votes before starting a new round.')]);
            }

            $round = $startPokerRound->handle($locked, $task);

            (new PokerRoundChanged($locked->id))->sendToOthers();

            return $round;
        });

        return response()->json(
            $this->presentPokerRound->handle($round->load('votes'), $game->load('players'), $player->id),
            201,
        );
    }
}
```

Create `app/Http/Controllers/Poker/PokerTaskEstimatesController.php`:

```php
<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PokerGuard;
use App\Actions\Poker\PresentPokerTask;
use App\Actions\Poker\SetPokerEstimate;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PokerTaskEstimatesController extends Controller
{
    public function update(Request $request, PokerGame $game, PokerTask $task, SetPokerEstimate $setPokerEstimate, PresentPokerTask $presentPokerTask): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::facilitator($game, $player);

        $validated = $request->validate([
            'value' => ['present', 'nullable', 'string', 'max:8'],
        ]);

        $estimated = DB::transaction(function () use ($game, $task, $player, $validated, $setPokerEstimate): PokerTask {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);

            $lockedTask = $locked->tasks()->whereKey($task->id)->firstOrFail();

            return $setPokerEstimate->handle($locked, $lockedTask, $validated['value']);
        });

        return response()->json($presentPokerTask->handle($estimated));
    }
}
```

- [ ] **Step 9: Routes**

In `routes/web.php` add the imports

```php
use App\Http\Controllers\Poker\PokerRevealsController;
use App\Http\Controllers\Poker\PokerRoundsController;
use App\Http\Controllers\Poker\PokerTaskEstimatesController;
```

and, inside the `poker/{game}` group after the `rounds/{round}/vote` lines:

```php
        Route::post('rounds/{round}/reveal', [PokerRevealsController::class, 'store'])->name('poker.rounds.reveal.store')->whereUuid('round');
        Route::post('tasks/{task}/rounds', [PokerRoundsController::class, 'store'])->name('poker.tasks.rounds.store')->whereUuid('task');
        Route::get('tasks/{task}/rounds', [PokerRoundsController::class, 'index'])->name('poker.tasks.rounds.index')->whereUuid('task');
        Route::put('tasks/{task}/estimate', [PokerTaskEstimatesController::class, 'update'])->name('poker.tasks.estimate.update')->whereUuid('task');
```

Then: `vendor/bin/sail artisan wayfinder:generate --with-form`

- [ ] **Step 10: Translations**

Append to `lang/{en,fr,es,de}.json` (only keys still missing; `Choose a card from the deck.` normally exists from Task 8):

| Key | fr | es | de |
|---|---|---|---|
| `Nobody has voted yet.` | `Personne n'a encore voté.` | `Nadie ha votado todavía.` | `Noch hat niemand abgestimmt.` |
| `Reveal the votes before setting an estimate.` | `Révélez les votes avant de fixer une estimation.` | `Revela los votos antes de fijar una estimación.` | `Decke die Stimmen auf, bevor du eine Schätzung festlegst.` |
| `Reveal the votes before starting a new round.` | `Révélez les votes avant de lancer un nouveau tour.` | `Revela los votos antes de empezar una nueva ronda.` | `Decke die Stimmen auf, bevor du eine neue Runde startest.` |
| `Select this task first.` | `Sélectionnez d'abord cette tâche.` | `Selecciona primero esta tarea.` | `Wähle zuerst diese Aufgabe aus.` |
| `Choose a card from the deck.` | `Choisissez une carte du jeu.` | `Elige una carta de la baraja.` | `Wähle eine Karte aus dem Deck.` |

In `lang/en.json` each key maps to itself.

- [ ] **Step 11: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerRevealTest.php tests/Feature/Poker/PokerEstimateTest.php tests/Feature/Poker/PokerRoundHistoryTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 12: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Poker/RevealPokerRound.php app/Actions/Poker/SetPokerEstimate.php app/Http/Controllers/Poker/PokerRevealsController.php app/Http/Controllers/Poker/PokerRoundsController.php app/Http/Controllers/Poker/PokerTaskEstimatesController.php routes/web.php tests/Pest.php tests/Feature/Poker/PokerRevealTest.php tests/Feature/Poker/PokerEstimateTest.php tests/Feature/Poker/PokerRoundHistoryTest.php lang
git commit -m "feat: reveal poker rounds, start re-votes, set estimates and list round history

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 10: Settings, end/reopen, guest link, facilitation and deletion

**Files:**
- Create: `app/Http/Controllers/Poker/PokerSettingsController.php`, `app/Http/Controllers/Poker/PokerStatusesController.php`, `app/Http/Controllers/Poker/PokerGuestTokensController.php`, `app/Http/Controllers/Poker/PokerFacilitatorsController.php`
- Modify: `app/Http/Controllers/Poker/PokerGamesController.php` (add `destroy`), `routes/web.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Poker/PokerSettingsTest.php`, `tests/Feature/Poker/PokerFacilitationTest.php`

**Interfaces:**
- Consumes: `PokerGuard::{notEnded, facilitator, canDelete}` (Task 5), `PokerDeckRules::{rules, resolve}` (Task 6), `PokerGame::hasVotes()`, events `PokerGameChanged`, `PokerGameDeleted` (Task 4), `BuildPokerSnapshot` (Task 4, for the existing `show`), Pest helpers of Tasks 2 and 9 (`pokerRevealTable`).
- Produces:
  - `PokerSettingsController::update(Request, PokerGame $game): Response` — facilitator; notEnded; validates `title`, `PokerDeckRules::rules(deckRequired: false)`, `guest_access_enabled`; deck change with votes → 422 `deck` "The deck can't change once votes exist."; `private function attributes(array $validated, PokerGame $locked): array` maps the validated array to model attributes (Plan 10b appends lines here); broadcasts `PokerGameChanged`; 204.
  - `PokerStatusesController::update(Request, PokerGame $game): Response` — `ended` required boolean; facilitator; allowed on ended games; ending keeps an existing `ended_at`, sets `current_task_id = null`; reopening clears `ended_at`; `PokerGameChanged`; 204.
  - `PokerGuestTokensController::store(Request, PokerGame $game): JsonResponse` — facilitator; notEnded; `{guestUrl}`; clears guests' secrets; `PokerGameChanged`.
  - `PokerFacilitatorsController::update(Request, PokerGame $game): Response` — `user_id`; transfer (facilitator, game not ended) or take control (non-guest team viewer naming themselves, also on an ended game so it can be reopened); `PokerGameChanged`; 204.
  - `PokerGamesController::destroy(Request, PokerGame $game): Response` — `PokerGuard::canDelete`; allowed on ended games; `PokerGameDeleted`; 204.

- [ ] **Step 1: Write the failing settings tests**

Create `tests/Feature/Poker/PokerSettingsTest.php`:

```php
<?php

use App\Enums\PokerDeck;
use App\Events\Poker\PokerGameChanged;
use App\Models\PokerGame;
use App\Models\PokerTask;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('renames the game', function () {
    $game = PokerGame::factory()->create(['title' => 'Old']);
    [$facilitator] = pokerFacilitator($game);

    $this->actingAs($facilitator)
        ->patchJson(route('poker.settings.update', $game), ['title' => 'Sprint 12 sizing'])
        ->assertNoContent();

    expect($game->fresh()->title)->toBe('Sprint 12 sizing');

    $this->actingAs($facilitator)
        ->patchJson(route('poker.settings.update', $game), ['title' => str_repeat('a', 121)])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('title');
});

it('changes the deck until votes exist', function () {
    $game = PokerGame::factory()->create(['deck_name' => 'Team scale']);
    [$facilitator, $facilitatorPlayer] = pokerFacilitator($game);

    $this->actingAs($facilitator)
        ->patchJson(route('poker.settings.update', $game), ['deck' => 'tshirt'])
        ->assertNoContent();

    $game->refresh();

    expect($game->deck)->toBe(PokerDeck::Tshirt)
        ->and($game->cards)->toBe(PokerDeck::Tshirt->cards())
        ->and($game->deck_name)->toBeNull();

    $this->actingAs($facilitator)
        ->patchJson(route('poker.settings.update', $game), [
            'deck' => 'custom',
            'custom_cards' => ['1', '2', '3'],
            'include_unknown' => false,
            'include_coffee' => false,
        ])
        ->assertNoContent();

    expect($game->fresh()->cards)->toBe(['1', '2', '3']);

    pokerVote(openPokerRound($game->fresh()), $facilitatorPlayer, '2');

    $this->actingAs($facilitator)
        ->patchJson(route('poker.settings.update', $game), ['deck' => 'fibonacci'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['deck' => "The deck can't change once votes exist."]);

    expect($game->fresh()->cards)->toBe(['1', '2', '3']);

    $this->actingAs($facilitator)
        ->patchJson(route('poker.settings.update', $game), ['title' => 'Still renamable'])
        ->assertNoContent();
});

it('toggles guest access', function () {
    $game = PokerGame::factory()->create();
    [$facilitator] = pokerFacilitator($game);

    $this->actingAs($facilitator)
        ->patchJson(route('poker.settings.update', $game), ['guest_access_enabled' => true])
        ->assertNoContent();

    expect($game->fresh()->guest_access_enabled)->toBeTrue();

    $this->actingAs($facilitator)
        ->getJson(route('poker.snapshot.show', $game))
        ->assertJsonPath('game.guestAccessEnabled', true)
        ->assertJsonPath('game.guestUrl', route('poker.join.show', $game->fresh()->guest_token));

    $this->actingAs($facilitator)
        ->patchJson(route('poker.settings.update', $game), ['guest_access_enabled' => false])
        ->assertNoContent();

    expect($game->fresh()->guest_access_enabled)->toBeFalse();
});

it('is facilitator-only', function () {
    $game = PokerGame::factory()->create();
    pokerFacilitator($game);
    [$member] = pokerMember($game);

    $this->actingAs($member)->patchJson(route('poker.settings.update', $game), ['title' => 'Mine'])->assertForbidden();
    $this->actingAs($member)->putJson(route('poker.status.update', $game), ['ended' => true])->assertForbidden();
    $this->actingAs($member)->postJson(route('poker.guest-token.store', $game))->assertForbidden();

    expect($game->fresh()->ended_at)->toBeNull();
    Event::assertNotDispatched(PokerGameChanged::class);
});

it('ends and reopens a game', function () {
    $table = pokerRevealTable();
    $game = $table['game'];
    $round = $table['round'];

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.status.update', $game), ['ended' => true])
        ->assertNoContent();

    $game->refresh();

    expect($game->ended_at)->not->toBeNull()
        ->and($game->current_task_id)->toBeNull();

    $this->actingAs($table['facilitator'])
        ->patchJson(route('poker.settings.update', $game), ['title' => 'Nope'])
        ->assertForbidden()
        ->assertJsonPath('message', 'This game has ended.');
    $this->actingAs($table['member'])
        ->postJson(route('poker.tasks.store', $game), ['title' => 'Late task'])
        ->assertForbidden();
    $this->actingAs($table['member'])
        ->putJson(route('poker.rounds.vote.update', [$game, $round]), ['value' => '5'])
        ->assertForbidden();
    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.current-task.update', $game), ['task_id' => $round->poker_task_id])
        ->assertForbidden();
    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.guest-token.store', $game))
        ->assertForbidden();

    expect(PokerTask::query()->where('title', 'Late task')->exists())->toBeFalse()
        ->and($round->votes()->count())->toBe(0);

    $this->actingAs($table['facilitator'])
        ->getJson(route('poker.snapshot.show', $game))
        ->assertOk()
        ->assertJsonPath('current', null);

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.status.update', $game), ['ended' => false])
        ->assertNoContent();

    expect($game->fresh()->ended_at)->toBeNull();

    $this->actingAs($table['facilitator'])
        ->patchJson(route('poker.settings.update', $game), ['title' => 'Back again'])
        ->assertNoContent();
});

it('regenerates the guest link and signs guests out', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    [$facilitator] = pokerFacilitator($game);
    $guest = pokerGuest($game);
    $oldToken = $game->guest_token;

    $response = $this->actingAs($facilitator)
        ->postJson(route('poker.guest-token.store', $game))
        ->assertOk();

    $game->refresh();

    expect($game->guest_token)->not->toBe($oldToken)
        ->and($response->json('guestUrl'))->toBe(route('poker.join.show', $game->guest_token))
        ->and($guest->fresh()->guest_secret_hash)->toBeNull()
        ->and($guest->fresh()->guest_name)->not->toBeNull();

    app('auth')->forgetGuards();

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->getJson(route('poker.snapshot.show', $game))
        ->assertForbidden();

    $this->get(route('poker.join.show', $oldToken))->assertNotFound();
    Event::assertDispatched(PokerGameChanged::class);
});

it('broadcasts game changes', function () {
    $game = PokerGame::factory()->create();
    [$facilitator] = pokerFacilitator($game);

    $this->actingAs($facilitator)
        ->patchJson(route('poker.settings.update', $game), ['title' => 'Renamed'])
        ->assertNoContent();

    $this->actingAs($facilitator)
        ->putJson(route('poker.status.update', $game), ['ended' => true])
        ->assertNoContent();

    Event::assertDispatchedTimes(PokerGameChanged::class, 2);
    Event::assertDispatched(PokerGameChanged::class, fn (PokerGameChanged $event) => $event->gameId === $game->id
        && $event->broadcastWith() === []);
});
```

- [ ] **Step 2: Write the failing facilitation and deletion tests**

Create `tests/Feature/Poker/PokerFacilitationTest.php`:

```php
<?php

use App\Enums\WorkspaceRole;
use App\Events\Poker\PokerGameChanged;
use App\Events\Poker\PokerGameDeleted;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\User;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('transfers facilitation to a team member', function () {
    $game = PokerGame::factory()->create();
    [$facilitator] = pokerFacilitator($game);
    [$member, $memberPlayer] = pokerMember($game);

    $this->actingAs($facilitator)
        ->putJson(route('poker.facilitator.update', $game), ['user_id' => $member->id])
        ->assertNoContent();

    expect($game->fresh()->facilitator_player_id)->toBe($memberPlayer->id);
    Event::assertDispatched(PokerGameChanged::class);

    $this->actingAs($facilitator)
        ->putJson(route('poker.facilitator.update', $game), ['user_id' => $member->id])
        ->assertForbidden();
});

it('transfers facilitation to a workspace admin who never joined', function () {
    $game = PokerGame::factory()->create();
    [$facilitator] = pokerFacilitator($game);
    $admin = workspaceManager($game->team->workspace);

    $this->actingAs($facilitator)
        ->putJson(route('poker.facilitator.update', $game), ['user_id' => $admin->id])
        ->assertNoContent();

    $adminPlayer = PokerPlayer::query()->where('poker_game_id', $game->id)->where('user_id', $admin->id)->sole();

    expect($game->fresh()->facilitator_player_id)->toBe($adminPlayer->id);
});

it('refuses transfers to outsiders', function () {
    $game = PokerGame::factory()->create();
    [$facilitator, $facilitatorPlayer] = pokerFacilitator($game);
    $outsider = User::factory()->create();

    $this->actingAs($facilitator)
        ->putJson(route('poker.facilitator.update', $game), ['user_id' => $outsider->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['user_id' => 'The facilitator must be a member of this team.']);

    expect($game->fresh()->facilitator_player_id)->toBe($facilitatorPlayer->id)
        ->and(PokerPlayer::query()->where('user_id', $outsider->id)->exists())->toBeFalse();
});

it('lets a member take control', function () {
    $game = PokerGame::factory()->create();
    [, $facilitatorPlayer] = pokerFacilitator($game);
    [$member, $memberPlayer] = pokerMember($game);
    [$other] = pokerMember($game);

    $this->actingAs($member)
        ->putJson(route('poker.facilitator.update', $game), ['user_id' => $other->id])
        ->assertForbidden();

    expect($game->fresh()->facilitator_player_id)->toBe($facilitatorPlayer->id);

    $this->actingAs($member)
        ->putJson(route('poker.facilitator.update', $game), ['user_id' => $member->id])
        ->assertNoContent();

    expect($game->fresh()->facilitator_player_id)->toBe($memberPlayer->id);
});

it('refuses guests taking control', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    [$facilitator, $facilitatorPlayer] = pokerFacilitator($game);
    $guest = pokerGuest($game);

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->putJson(route('poker.facilitator.update', $game), ['user_id' => $facilitator->id])
        ->assertForbidden();

    expect($game->fresh()->facilitator_player_id)->toBe($facilitatorPlayer->id);
});

it('lets a member take control of an ended game to reopen it', function () {
    $game = PokerGame::factory()->ended()->create();
    pokerFacilitator($game);
    [$member, $memberPlayer] = pokerMember($game);

    $this->actingAs($member)
        ->putJson(route('poker.facilitator.update', $game), ['user_id' => $member->id])
        ->assertNoContent();

    expect($game->fresh()->facilitator_player_id)->toBe($memberPlayer->id);

    $this->actingAs($member)
        ->putJson(route('poker.status.update', $game), ['ended' => false])
        ->assertNoContent();

    expect($game->fresh()->ended_at)->toBeNull();
});

it('refuses hand-overs on an ended game', function () {
    $game = PokerGame::factory()->ended()->create();
    [$facilitator, $facilitatorPlayer] = pokerFacilitator($game);
    [$member] = pokerMember($game);

    $this->actingAs($facilitator)
        ->putJson(route('poker.facilitator.update', $game), ['user_id' => $member->id])
        ->assertForbidden();

    expect($game->fresh()->facilitator_player_id)->toBe($facilitatorPlayer->id);
});

it('deletes as facilitator or workspace admin only', function (string $who) {
    $game = PokerGame::factory()->create();
    [$facilitator] = pokerFacilitator($game);
    [$member] = pokerMember($game);
    $actor = match ($who) {
        'facilitator' => $facilitator,
        'admin' => workspaceManager($game->team->workspace),
        'owner' => workspaceManager($game->team->workspace, WorkspaceRole::Owner),
    };

    $this->actingAs($member)
        ->deleteJson(route('poker.destroy', $game))
        ->assertForbidden()
        ->assertJsonPath('message', 'Only the facilitator or a workspace admin can delete this game.');

    expect(PokerGame::query()->whereKey($game->id)->exists())->toBeTrue();

    $this->actingAs($actor)->deleteJson(route('poker.destroy', $game))->assertNoContent();

    expect(PokerGame::query()->whereKey($game->id)->exists())->toBeFalse();
    Event::assertDispatched(PokerGameDeleted::class, fn (PokerGameDeleted $event) => $event->gameId === $game->id);
})->with(['facilitator', 'admin', 'owner']);

it('deletes ended games', function () {
    $game = PokerGame::factory()->ended()->create();
    [$facilitator] = pokerFacilitator($game);

    $this->actingAs($facilitator)->deleteJson(route('poker.destroy', $game))->assertNoContent();

    expect(PokerGame::query()->whereKey($game->id)->exists())->toBeFalse();
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerSettingsTest.php tests/Feature/Poker/PokerFacilitationTest.php`
Expected: FAIL — `Route [poker.settings.update] not defined.` (and `poker.status.update`, `poker.guest-token.store`, `poker.facilitator.update`, `poker.destroy`).

- [ ] **Step 4: `PokerSettingsController`**

Create `app/Http/Controllers/Poker/PokerSettingsController.php`:

```php
<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PokerDeckRules;
use App\Actions\Poker\PokerGuard;
use App\Events\Poker\PokerGameChanged;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PokerSettingsController extends Controller
{
    public function update(Request $request, PokerGame $game): Response
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::facilitator($game, $player);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:120'],
            ...PokerDeckRules::rules(deckRequired: false),
            'guest_access_enabled' => ['sometimes', 'boolean'],
        ]);

        DB::transaction(function () use ($game, $player, $validated): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);

            if (array_key_exists('deck', $validated) && $locked->hasVotes()) {
                throw ValidationException::withMessages(['deck' => __("The deck can't change once votes exist.")]);
            }

            $locked->update($this->attributes($validated, $locked));

            (new PokerGameChanged($locked->id))->sendToOthers();
        });

        return response()->noContent();
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function attributes(array $validated, PokerGame $locked): array
    {
        $attributes = Arr::only($validated, ['title', 'guest_access_enabled']);

        if (array_key_exists('deck', $validated)) {
            [$deck, $cards] = PokerDeckRules::resolve($validated);

            $attributes = [...$attributes, 'deck' => $deck, 'cards' => $cards, 'deck_name' => null];
        }

        return $attributes;
    }
}
```

`$locked` is part of the signature because Plan 10b's anonymity and saved-deck lines read it.

- [ ] **Step 5: `PokerStatusesController`, `PokerGuestTokensController`, `PokerFacilitatorsController`**

Create `app/Http/Controllers/Poker/PokerStatusesController.php`:

```php
<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PokerGuard;
use App\Events\Poker\PokerGameChanged;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class PokerStatusesController extends Controller
{
    /**
     * The only mutation allowed on an ended game besides deletion, since
     * reopening is the way back.
     */
    public function update(Request $request, PokerGame $game): Response
    {
        $player = PokerPlayer::current($request);

        PokerGuard::facilitator($game, $player);

        $validated = $request->validate([
            'ended' => ['required', 'boolean'],
        ]);

        DB::transaction(function () use ($game, $player, $validated): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::facilitator($locked, $player);

            $locked->update($validated['ended']
                ? ['ended_at' => $locked->ended_at ?? now(), 'current_task_id' => null]
                : ['ended_at' => null]);

            (new PokerGameChanged($locked->id))->sendToOthers();
        });

        return response()->noContent();
    }
}
```

Create `app/Http/Controllers/Poker/PokerGuestTokensController.php`:

```php
<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PokerGuard;
use App\Events\Poker\PokerGameChanged;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PokerGuestTokensController extends Controller
{
    public function store(Request $request, PokerGame $game): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::facilitator($game, $player);

        $guestToken = DB::transaction(function () use ($game, $player): string {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);

            $locked->update(['guest_token' => Str::random(40)]);

            $locked->players()
                ->whereNull('user_id')
                ->whereNotNull('guest_secret_hash')
                ->update(['guest_secret_hash' => null]);

            (new PokerGameChanged($locked->id))->sendToOthers();

            return $locked->guest_token;
        });

        return response()->json(['guestUrl' => route('poker.join.show', $guestToken)]);
    }
}
```

Create `app/Http/Controllers/Poker/PokerFacilitatorsController.php`:

```php
<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PokerGuard;
use App\Events\Poker\PokerGameChanged;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PokerFacilitatorsController extends Controller
{
    public function update(Request $request, PokerGame $game): Response
    {
        $player = PokerPlayer::current($request);

        $validated = $request->validate([
            'user_id' => ['required', 'uuid', 'exists:users,id'],
        ]);

        $user = User::query()->whereKey($validated['user_id'])->firstOrFail();

        DB::transaction(function () use ($game, $player, $user): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            $locked->isFacilitator($player)
                ? $this->ensureCanHandOver($locked, $user)
                : $this->ensureTakesControl($locked, $player, $user);

            $newFacilitator = PokerPlayer::query()->firstOrCreate(['poker_game_id' => $locked->id, 'user_id' => $user->id]);

            $locked->update(['facilitator_player_id' => $newFacilitator->id]);

            (new PokerGameChanged($locked->id))->sendToOthers();
        });

        return response()->noContent();
    }

    private function ensureCanHandOver(PokerGame $locked, User $user): void
    {
        PokerGuard::notEnded($locked);

        if ($user->can('view', $locked->team)) {
            return;
        }

        throw ValidationException::withMessages(['user_id' => __('The facilitator must be a member of this team.')]);
    }

    /**
     * A missing facilitator would freeze a game that spans days, so any
     * non-guest player of the team may make themselves facilitator, also
     * on an ended game, which only a facilitator can reopen.
     */
    private function ensureTakesControl(PokerGame $locked, PokerPlayer $player, User $user): void
    {
        if ($player->isGuest() || $player->user_id !== $user->id || ! $user->can('view', $locked->team)) {
            throw new AuthorizationException(__('Only the facilitator can do this.'));
        }
    }
}
```

- [ ] **Step 6: `PokerGamesController::destroy`**

Replace `app/Http/Controllers/Poker/PokerGamesController.php` with (the `show` method is unchanged from Task 5):

```php
<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\BuildPokerSnapshot;
use App\Actions\Poker\PokerGuard;
use App\Enums\PokerDeck;
use App\Events\Poker\PokerGameDeleted;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class PokerGamesController extends Controller
{
    public function show(Request $request, PokerGame $game, BuildPokerSnapshot $buildPokerSnapshot): Response
    {
        return Inertia::render('poker/show', [
            'snapshot' => $buildPokerSnapshot->handle($game, PokerPlayer::current($request)),
            'deckOptions' => PokerDeck::options(),
        ]);
    }

    public function destroy(Request $request, PokerGame $game): HttpResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::canDelete($game, $player);

        DB::transaction(function () use ($game, $player): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::canDelete($locked, $player);

            $gameId = $locked->id;

            $locked->delete();

            (new PokerGameDeleted($gameId))->sendToOthers();
        });

        return response()->noContent();
    }
}
```

- [ ] **Step 7: Routes**

In `routes/web.php` add the imports

```php
use App\Http\Controllers\Poker\PokerFacilitatorsController;
use App\Http\Controllers\Poker\PokerGuestTokensController;
use App\Http\Controllers\Poker\PokerSettingsController;
use App\Http\Controllers\Poker\PokerStatusesController;
```

and, at the end of the `poker/{game}` group:

```php
        Route::patch('settings', [PokerSettingsController::class, 'update'])->name('poker.settings.update');
        Route::put('status', [PokerStatusesController::class, 'update'])->name('poker.status.update');
        Route::post('guest-token', [PokerGuestTokensController::class, 'store'])->name('poker.guest-token.store');
        Route::put('facilitator', [PokerFacilitatorsController::class, 'update'])->name('poker.facilitator.update');
        Route::delete('/', [PokerGamesController::class, 'destroy'])->name('poker.destroy');
```

Then: `vendor/bin/sail artisan wayfinder:generate --with-form`

- [ ] **Step 8: Translations**

Append to `lang/{en,fr,es,de}.json` (only keys still missing; the delete message normally exists from Task 5):

| Key | fr | es | de |
|---|---|---|---|
| `The deck can't change once votes exist.` | `Le jeu de cartes ne peut plus changer une fois que des votes existent.` | `La baraja no puede cambiar una vez que hay votos.` | `Das Deck kann nicht mehr geändert werden, sobald Stimmen vorliegen.` |
| `Only the facilitator or a workspace admin can delete this game.` | `Seuls l'animateur ou un administrateur de l'espace de travail peuvent supprimer cette partie.` | `Solo el facilitador o un administrador del espacio de trabajo pueden eliminar esta partida.` | `Nur der Moderator oder ein Admin des Arbeitsbereichs kann dieses Spiel löschen.` |

- [ ] **Step 9: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerSettingsTest.php tests/Feature/Poker/PokerFacilitationTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 10: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Http/Controllers/Poker/PokerSettingsController.php app/Http/Controllers/Poker/PokerStatusesController.php app/Http/Controllers/Poker/PokerGuestTokensController.php app/Http/Controllers/Poker/PokerFacilitatorsController.php app/Http/Controllers/Poker/PokerGamesController.php routes/web.php tests/Feature/Poker/PokerSettingsTest.php tests/Feature/Poker/PokerFacilitationTest.php lang
git commit -m "feat: let facilitators configure, end, share, hand over and delete poker games

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 11: Team estimation history page (`TeamEstimatesController`)

**Files:**
- Create: `app/Http/Controllers/TeamEstimatesController.php`, `resources/js/pages/poker/estimates.tsx` (placeholder, replaced in Task 17)
- Modify: `routes/web.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Poker/PokerEstimatesPageTest.php`

**Interfaces:**
- Consumes: `PresentPokerRound::handle(PokerRound $round, PokerGame $game, ?string $viewerPlayerId, bool $listUnrevealedVoters = true)` (Task 4; needs `$round->votes` and `$game->players` loaded), `TeamPolicy::view`, `Team::pokerGames()` (Task 2), `HasGuestIdentity::displayName()`.
- Produces: `TeamEstimatesController::index(Request $request, Workspace $workspace, Team $team, PresentPokerRound $presentPokerRound): Response` → `Inertia::render('poker/estimates', [...])` with props:
  - `workspace` `{id, name, slug}`, `team` `{id, name}`;
  - `games` `[{id, title}]` (team games, newest first);
  - `filters` `{game: ?string, q: string}` (`game` kept only when it is the id of one of `games`);
  - `tasks` `[{id, title, gameId, gameTitle, estimate, roundsCount, estimatedAt, rounds, players}]` — `rounds`: revealed rounds only, newest first, presented for the viewer's player in that game (`null` when the viewer never joined it); `players`: `[{id, name}]` of the game's players who voted in those rounds;
  - `pagination` `{currentPage, lastPage, total}`; 50 per page; `estimated_at` desc then `id`; title `ILIKE` with `%`, `_` and `\` escaped; constant number of queries.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Poker/PokerEstimatesPageTest.php`:

```php
<?php

use App\Enums\PokerRevealReason;
use App\Models\PokerGame;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * @param  array<string, string>  $query
 */
function pokerEstimatesPage(TestCase $test, User $user, Team $team, array $query = []): TestResponse
{
    return $test->actingAs($user)
        ->get(route('teams.estimates.index', ['workspace' => $team->workspace, 'team' => $team, ...$query]))
        ->assertOk();
}

/**
 * @return array<int, array<string, mixed>>
 */
function pokerEstimateRows(TestResponse $response): array
{
    return $response->viewData('page')['props']['tasks'];
}

function estimatedPokerTask(PokerGame $game, string $title, string $estimatedAt, string $estimate = '5'): PokerTask
{
    return PokerTask::factory()->estimated($estimate)->create([
        'poker_game_id' => $game->id,
        'title' => $title,
        'estimated_at' => $estimatedAt,
    ]);
}

it('lists estimated tasks newest first', function () {
    $game = PokerGame::factory()->create(['title' => 'Sprint 12']);
    [$user] = pokerFacilitator($game);
    $older = estimatedPokerTask($game, 'Login page', '2026-09-01 10:00:00', '3');
    $newer = estimatedPokerTask($game, 'Search', '2026-09-20 10:00:00', '8');
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Not estimated']);
    $otherTeamGame = PokerGame::factory()->create();
    estimatedPokerTask($otherTeamGame, 'Elsewhere', '2026-09-25 10:00:00');

    $response = pokerEstimatesPage($this, $user, $game->team)
        ->assertInertia(fn (Assert $page) => $page
            ->component('poker/estimates')
            ->where('team.id', $game->team_id)
            ->where('games', [['id' => $game->id, 'title' => 'Sprint 12']])
            ->where('filters', ['game' => null, 'q' => ''])
            ->where('pagination', ['currentPage' => 1, 'lastPage' => 1, 'total' => 2]));

    $rows = pokerEstimateRows($response);

    expect(collect($rows)->pluck('id')->all())->toBe([$newer->id, $older->id])
        ->and($rows[0])->toMatchArray([
            'title' => 'Search',
            'gameId' => $game->id,
            'gameTitle' => 'Sprint 12',
            'estimate' => '8',
            'roundsCount' => 0,
            'rounds' => [],
            'players' => [],
        ]);
});

it('filters by game and title', function () {
    $team = Team::factory()->create();
    $first = PokerGame::factory()->create(['team_id' => $team->id]);
    $second = PokerGame::factory()->create(['team_id' => $team->id]);
    [$user] = pokerFacilitator($first);
    $login = estimatedPokerTask($first, 'Login page', '2026-09-01 10:00:00');
    $percent = estimatedPokerTask($first, 'Raise coverage to 80%', '2026-09-02 10:00:00');
    $other = estimatedPokerTask($second, 'Login flow', '2026-09-03 10:00:00');
    estimatedPokerTask($first, 'Coverage report 80 pages', '2026-09-04 10:00:00');

    $ids = fn (array $query) => collect(pokerEstimateRows(pokerEstimatesPage($this, $user, $team, $query)))->pluck('id')->all();

    expect($ids(['game' => $second->id]))->toBe([$other->id])
        ->and($ids(['q' => 'LOGIN']))->toBe([$other->id, $login->id])
        ->and($ids(['game' => $first->id, 'q' => 'login']))->toBe([$login->id])
        ->and($ids(['q' => '80%']))->toBe([$percent->id])
        ->and($ids(['game' => 'not-a-game']))->toHaveCount(4);

    pokerEstimatesPage($this, $user, $team, ['game' => 'not-a-game'])
        ->assertInertia(fn (Assert $page) => $page->where('filters.game', null));
});

it('paginates by 50', function () {
    $game = PokerGame::factory()->create();
    [$user] = pokerFacilitator($game);

    foreach (range(1, 51) as $index) {
        estimatedPokerTask($game, "Task {$index}", now()->subMinutes($index)->toDateTimeString());
    }

    $firstPage = pokerEstimatesPage($this, $user, $game->team);

    expect(pokerEstimateRows($firstPage))->toHaveCount(50);
    $firstPage->assertInertia(fn (Assert $page) => $page->where('pagination', ['currentPage' => 1, 'lastPage' => 2, 'total' => 51]));

    $secondPage = pokerEstimatesPage($this, $user, $game->team, ['page' => '2']);

    expect(collect(pokerEstimateRows($secondPage))->pluck('title')->all())->toBe(['Task 51']);
});

it('shows revealed rounds only with their values and results', function () {
    $table = pokerRevealTable();
    $game = $table['game'];
    $task = $table['round']->task;
    pokerVote($table['round'], $table['facilitatorPlayer'], '5');
    pokerVote($table['round'], $table['memberPlayer'], '8');
    $table['round']->update(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual]);
    $task->update(['estimate' => '8', 'estimate_numeric' => 8, 'estimated_at' => now()]);
    $open = PokerRound::factory()->create(['poker_task_id' => $task->id, 'number' => 2]);
    pokerVote($open, $table['facilitatorPlayer'], '13');
    pokerVote($open, $table['memberPlayer'], '21');

    $response = pokerEstimatesPage($this, $table['member'], $game->team);
    $row = pokerEstimateRows($response)[0];

    expect($row['roundsCount'])->toBe(2)
        ->and($row['rounds'])->toHaveCount(1)
        ->and($row['rounds'][0]['number'])->toBe(1)
        ->and($row['rounds'][0]['myVote'])->toBe('8')
        ->and($row['rounds'][0]['result']['average'])->toBe(6.5)
        ->and(collect($row['rounds'][0]['votes'])->pluck('value', 'playerId')->all())->toEqual([
            $table['facilitatorPlayer']->id => '5',
            $table['memberPlayer']->id => '8',
        ])
        ->and(collect($row['players'])->pluck('name', 'id')->all())->toEqual([
            $table['facilitatorPlayer']->id => $table['facilitator']->name,
            $table['memberPlayer']->id => $table['member']->name,
        ])
        ->and(json_encode($response->viewData('page')['props']))->not->toContain('"21"')
        ->and(json_encode($response->viewData('page')['props']))->not->toContain('"13"');
});

it('refuses non-members and guests', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    $guest = pokerGuest($game);
    $url = route('teams.estimates.index', ['workspace' => $game->team->workspace, 'team' => $game->team]);

    $this->withCookies(pokerGuestCookie($guest))->get($url)->assertRedirect(route('login'));

    $outsider = User::factory()->create();
    $game->team->workspace->members()->attach($outsider, ['role' => 'member']);

    $this->actingAs($outsider)->get($url)->assertForbidden();
});

it('loads with a constant number of queries', function () {
    $game = PokerGame::factory()->create();
    [$user, $facilitatorPlayer] = pokerFacilitator($game);

    $seed = function (int $count) use ($game, $facilitatorPlayer): void {
        $member = pokerMember($game)[1];

        foreach (range(1, $count) as $index) {
            $task = estimatedPokerTask($game, "Task {$index}", now()->subMinutes($index)->toDateTimeString());
            $round = PokerRound::factory()->revealed()->create(['poker_task_id' => $task->id]);
            pokerVote($round, $facilitatorPlayer, '5');
            pokerVote($round, $member, '8');
        }

        $otherGame = PokerGame::factory()->create(['team_id' => $game->team_id]);
        estimatedPokerTask($otherGame, 'Other game task', now()->toDateTimeString());
    };

    $countQueries = function () use ($user, $game): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        pokerEstimatesPage($this, $user, $game->team);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $seed(2);
    $countQueries();
    $small = $countQueries();

    $seed(6);

    expect($countQueries())->toBe($small);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerEstimatesPageTest.php`
Expected: FAIL — `Route [teams.estimates.index] not defined.`

- [ ] **Step 3: The controller**

Create `app/Http/Controllers/TeamEstimatesController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Poker\PresentPokerRound;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\PokerVote;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TeamEstimatesController extends Controller
{
    private const PerPage = 50;

    public function __construct(private PresentPokerRound $presentPokerRound) {}

    public function index(Request $request, Workspace $workspace, Team $team): Response
    {
        Gate::authorize('view', $team);

        $user = $request->user();
        $games = $team->pokerGames()->latest()->get(['id', 'team_id', 'title', 'created_at']);
        $gameId = $this->gameFilter($request, $games);
        $search = $this->searchFilter($request);

        $tasks = PokerTask::query()
            ->whereIn('poker_game_id', $games->modelKeys())
            ->whereNotNull('estimated_at')
            ->when($gameId !== null, fn ($query) => $query->where('poker_game_id', $gameId))
            ->when($search !== '', fn ($query) => $query->where('title', 'ilike', '%'.$this->escapeLike($search).'%'))
            ->with([
                'game.players.user',
                'rounds' => fn ($query) => $query->whereNotNull('revealed_at')->reorder()->orderByDesc('number')->with('votes'),
            ])
            ->withCount('rounds')
            ->orderByDesc('estimated_at')
            ->orderBy('id')
            ->paginate(self::PerPage)
            ->withQueryString();

        return Inertia::render('poker/estimates', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => $team->only(['id', 'name']),
            'games' => $games->map(fn (PokerGame $game) => ['id' => $game->id, 'title' => $game->title])->values(),
            'filters' => ['game' => $gameId, 'q' => $search],
            'tasks' => collect($tasks->items())->map(fn (PokerTask $task) => $this->presentRow($task, $user))->values(),
            'pagination' => [
                'currentPage' => $tasks->currentPage(),
                'lastPage' => $tasks->lastPage(),
                'total' => $tasks->total(),
            ],
        ]);
    }

    /**
     * @return array{
     *     id: string,
     *     title: string,
     *     gameId: string,
     *     gameTitle: string,
     *     estimate: ?string,
     *     roundsCount: int,
     *     estimatedAt: ?string,
     *     rounds: array<int, array<string, mixed>>,
     *     players: array<int, array{id: string, name: string}>
     * }
     */
    private function presentRow(PokerTask $task, User $user): array
    {
        $game = $task->game;
        $viewerPlayerId = $game->players->firstWhere('user_id', $user->id)?->id;
        $voterIds = $task->rounds->flatMap(fn (PokerRound $round) => $round->votes->map(fn (PokerVote $vote) => $vote->poker_player_id))->unique();

        return [
            'id' => $task->id,
            'title' => $task->title,
            'gameId' => $game->id,
            'gameTitle' => $game->title,
            'estimate' => $task->estimate,
            'roundsCount' => (int) $task->rounds_count,
            'estimatedAt' => $task->estimated_at?->toIso8601String(),
            'rounds' => $task->rounds
                ->map(fn (PokerRound $round) => $this->presentPokerRound->handle($round, $game, $viewerPlayerId))
                ->values()
                ->all(),
            'players' => $game->players
                ->filter(fn (PokerPlayer $player) => $voterIds->contains($player->id))
                ->map(fn (PokerPlayer $player) => ['id' => $player->id, 'name' => $player->displayName()])
                ->values()
                ->all(),
        ];
    }

    /**
     * @param  Collection<int, PokerGame>  $games
     */
    private function gameFilter(Request $request, Collection $games): ?string
    {
        $gameId = $request->query('game');

        if (! is_string($gameId)) {
            return null;
        }

        return $games->contains('id', $gameId) ? $gameId : null;
    }

    private function searchFilter(Request $request): string
    {
        $search = $request->query('q');

        return is_string($search) ? trim($search) : '';
    }

    private function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}
```

`$games->contains('id', …)` compares loosely; ids are uuid strings, so a non-uuid query value never matches.

- [ ] **Step 4: Placeholder page**

Create `resources/js/pages/poker/estimates.tsx` (Task 17 replaces it; it exists now because `inertia.testing.ensure_pages_exist` is on):

```tsx
import { Head } from '@inertiajs/react';
import { useTrans } from '@/hooks/use-trans';

export default function PokerEstimates() {
    const { t } = useTrans();

    return <Head title={t('Estimation history')} />;
}
```

- [ ] **Step 5: Route**

In `routes/web.php` add `use App\Http\Controllers\TeamEstimatesController;` and, inside the `w/{workspace}` group after the `teams/{team}/poker-games` line:

```php
            Route::get('teams/{team}/estimates', [TeamEstimatesController::class, 'index'])->name('teams.estimates.index');
```

Then: `vendor/bin/sail artisan wayfinder:generate --with-form`

- [ ] **Step 6: Translations**

Append to `lang/{en,fr,es,de}.json` (only if missing):

| Key | fr | es | de |
|---|---|---|---|
| `Estimation history` | `Historique des estimations` | `Historial de estimaciones` | `Schätzungsverlauf` |

- [ ] **Step 7: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerEstimatesPageTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 8: Pint, phpstan, types, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
npm run types:check
npx vp check --fix resources/js/pages/poker/estimates.tsx
git add app/Http/Controllers/TeamEstimatesController.php resources/js/pages/poker/estimates.tsx routes/web.php tests/Feature/Poker/PokerEstimatesPageTest.php lang
git commit -m "feat: list a team's estimated poker tasks with their revealed rounds

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 12: Redaction suite (main invariant across every surface)

**Files:**
- Test: create `tests/Feature/Poker/PokerRedactionTest.php`
- Modify: only if a test fails — the offending presenter or controller (expected: none; fix in its own commit with a `fix:` message)

**Interfaces:**
- Consumes: every endpoint of Tasks 5–11 (`poker.show`, `poker.snapshot.show`, `poker.rounds.vote.update`, `poker.rounds.vote.destroy`, `poker.rounds.reveal.store`, `poker.tasks.rounds.store`, `poker.tasks.rounds.index`, `poker.tasks.estimate.update`, `poker.current-task.update`, `teams.estimates.index`), `BuildPokerSnapshot`, `PokerVoteChanged`, Pest helpers of Tasks 2 and 9.
- Produces: `tests/Feature/Poker/PokerRedactionTest.php` with helpers `pokerPayloadExposes(array|string $payload, PokerPlayer $player, string $value): bool` (true when the JSON contains that player's id next to that value: `"playerId":"<id>","value":"<value>"`), `pokerPayloadMentions(array|string $payload, string $value): bool` (true when the JSON contains `"value":"<value>"` or `"myVote":"<value>"` anywhere), `pokerViewerRequest(TestCase $test, User|PokerPlayer $viewer): TestCase` (acts as a member, or as a guest with a clean auth guard and the guest cookie). Plan 10b Task 2 moves these helpers to `tests/Pest.php`.

- [ ] **Step 1: Write the redaction tests**

Create `tests/Feature/Poker/PokerRedactionTest.php`:

```php
<?php

use App\Actions\Poker\BuildPokerSnapshot;
use App\Enums\PokerRevealReason;
use App\Events\Poker\PokerVoteChanged;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

beforeEach(function () {
    Event::fake();
});

/**
 * @param  array<array-key, mixed>|string  $payload
 */
function pokerPayloadJson(array|string $payload): string
{
    return is_string($payload) ? $payload : (string) json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/**
 * @param  array<array-key, mixed>|string  $payload
 */
function pokerPayloadExposes(array|string $payload, PokerPlayer $player, string $value): bool
{
    return str_contains(pokerPayloadJson($payload), "\"playerId\":\"{$player->id}\",\"value\":\"{$value}\"");
}

/**
 * @param  array<array-key, mixed>|string  $payload
 */
function pokerPayloadMentions(array|string $payload, string $value): bool
{
    $json = pokerPayloadJson($payload);

    return str_contains($json, "\"value\":\"{$value}\"") || str_contains($json, "\"myVote\":\"{$value}\"");
}

function pokerViewerRequest(TestCase $test, User|PokerPlayer $viewer): TestCase
{
    if ($viewer instanceof User) {
        return $test->actingAs($viewer);
    }

    app('auth')->forgetGuards();

    return $test->withCookies(pokerGuestCookie($viewer))->withCredentials();
}

/**
 * @return array{
 *     game: PokerGame,
 *     task: PokerTask,
 *     facilitator: User,
 *     facilitatorPlayer: PokerPlayer,
 *     member: User,
 *     memberPlayer: PokerPlayer,
 *     guest: PokerPlayer,
 *     values: array<string, string>
 * }
 */
function redactionTable(): array
{
    $table = pokerRevealTable();
    $guest = pokerGuest($table['game']);

    return [
        'game' => $table['game'],
        'task' => $table['round']->task,
        'facilitator' => $table['facilitator'],
        'facilitatorPlayer' => $table['facilitatorPlayer'],
        'member' => $table['member'],
        'memberPlayer' => $table['memberPlayer'],
        'guest' => $guest,
        'values' => [
            $table['facilitatorPlayer']->id => '8',
            $table['memberPlayer']->id => '13',
            $guest->id => '3',
        ],
    ];
}

/**
 * Every surface a viewer can read while the round is open.
 *
 * @return array<string, array<array-key, mixed>|string>
 */
function pokerSurfacesFor(TestCase $test, array $table, User|PokerPlayer $viewer, PokerPlayer $viewerPlayer): array
{
    $game = $table['game']->fresh();

    $surfaces = [
        'built snapshot' => app(BuildPokerSnapshot::class)->handle($game, $viewerPlayer->fresh()),
        'snapshot endpoint' => pokerViewerRequest($test, $viewer)->getJson(route('poker.snapshot.show', $game))->assertOk()->getContent(),
        'page props' => pokerViewerRequest($test, $viewer)->get(route('poker.show', $game))->assertOk()->viewData('page')['props'],
        'round history' => pokerViewerRequest($test, $viewer)->getJson(route('poker.tasks.rounds.index', [$game, $table['task']]))->assertOk()->getContent(),
    ];

    if ($viewer instanceof User) {
        $surfaces['estimates page'] = $test->actingAs($viewer)
            ->get(route('teams.estimates.index', ['workspace' => $game->team->workspace, 'team' => $game->team]))
            ->assertOk()
            ->viewData('page')['props'];
    }

    return $surfaces;
}

/**
 * @return array<int, array{0: User|PokerPlayer, 1: PokerPlayer}>
 */
function pokerViewers(array $table): array
{
    return [
        [$table['facilitator'], $table['facilitatorPlayer']],
        [$table['member'], $table['memberPlayer']],
        [$table['guest'], $table['guest']],
    ];
}

it('never shows another player\'s value before reveal, on any surface, for the facilitator too', function () {
    $table = redactionTable();
    $round = $table['game']->fresh()->latestRoundOfCurrentTask();

    /** @var array<string, TestResponse> $voteResponses */
    $voteResponses = [];

    foreach (pokerViewers($table) as [$viewer, $player]) {
        $voteResponses[$player->id] = pokerViewerRequest($this, $viewer)
            ->putJson(route('poker.rounds.vote.update', [$table['game'], $round]), ['value' => $table['values'][$player->id]])
            ->assertOk();
    }

    $players = [$table['facilitatorPlayer'], $table['memberPlayer'], $table['guest']];

    foreach (pokerViewers($table) as [$viewer, $viewerPlayer]) {
        $others = array_filter($players, fn (PokerPlayer $player) => $player->id !== $viewerPlayer->id);

        foreach ($others as $other) {
            $otherValue = $table['values'][$other->id];

            expect(pokerPayloadMentions($voteResponses[$viewerPlayer->id]->getContent(), $otherValue))
                ->toBeFalse("vote response of {$viewerPlayer->id} mentions {$otherValue}");

            foreach (pokerSurfacesFor($this, $table, $viewer, $viewerPlayer) as $surface => $payload) {
                expect(pokerPayloadExposes($payload, $other, $otherValue))->toBeFalse("{$surface} exposes {$other->id}")
                    ->and(pokerPayloadMentions($payload, $otherValue))->toBeFalse("{$surface} mentions {$otherValue}");
            }
        }
    }

    $withdrawn = pokerViewerRequest($this, $table['member'])
        ->deleteJson(route('poker.rounds.vote.destroy', [$table['game'], $round]))
        ->assertOk()
        ->assertJsonPath('myVote', null);

    foreach (['8', '13', '3'] as $value) {
        expect(pokerPayloadMentions($withdrawn->getContent(), $value))->toBeFalse();
    }

    $broadcasts = collect(Event::dispatched(PokerVoteChanged::class))
        ->map(fn (array $arguments) => $arguments[0]->broadcastWith());

    expect($broadcasts)->toHaveCount(4);

    foreach ($broadcasts as $payload) {
        expect(array_keys($payload))->toBe(['roundId', 'playerId', 'hasVoted', 'votesCount', 'version']);

        foreach (['8', '13', '3'] as $value) {
            expect(pokerPayloadMentions($payload, $value))->toBeFalse()
                ->and(in_array($value, $payload, true))->toBeFalse();
        }
    }
});

it('shows every value to every player after reveal', function () {
    $table = redactionTable();
    $round = $table['game']->fresh()->latestRoundOfCurrentTask();
    $players = [$table['facilitatorPlayer'], $table['memberPlayer'], $table['guest']];

    foreach (pokerViewers($table) as [$viewer, $player]) {
        pokerViewerRequest($this, $viewer)
            ->putJson(route('poker.rounds.vote.update', [$table['game'], $round]), ['value' => $table['values'][$player->id]])
            ->assertOk();
    }

    $reveal = pokerViewerRequest($this, $table['facilitator'])
        ->postJson(route('poker.rounds.reveal.store', [$table['game'], $round]))
        ->assertOk();

    foreach ($players as $player) {
        expect(pokerPayloadExposes($reveal->getContent(), $player, $table['values'][$player->id]))->toBeTrue();
    }

    foreach (pokerViewers($table) as [$viewer, $viewerPlayer]) {
        $surfaces = pokerSurfacesFor($this, $table, $viewer, $viewerPlayer);

        foreach (['built snapshot', 'snapshot endpoint', 'page props', 'round history'] as $surface) {
            foreach ($players as $player) {
                expect(pokerPayloadExposes($surfaces[$surface], $player, $table['values'][$player->id]))
                    ->toBeTrue("{$surface} hides {$player->id} from {$viewerPlayer->id}");
            }
        }
    }
});

it('never exposes a round left unrevealed, even after the task is estimated from an earlier round', function () {
    $table = redactionTable();
    $game = $table['game'];
    $first = $game->fresh()->latestRoundOfCurrentTask();
    pokerVote($first, $table['facilitatorPlayer'], '5');
    pokerVote($first, $table['memberPlayer'], '5');

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.rounds.reveal.store', [$game, $first]))
        ->assertOk();
    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$game, $table['task']]), ['value' => '5'])
        ->assertOk();

    $second = PokerRound::query()->whereKey(
        $this->actingAs($table['facilitator'])
            ->postJson(route('poker.tasks.rounds.store', [$game, $table['task']]))
            ->assertCreated()
            ->json('id'),
    )->firstOrFail();

    foreach (pokerViewers($table) as [$viewer, $player]) {
        pokerViewerRequest($this, $viewer)
            ->putJson(route('poker.rounds.vote.update', [$game, $second]), ['value' => $table['values'][$player->id]])
            ->assertOk();
    }

    $next = PokerTask::factory()->create(['poker_game_id' => $game->id]);

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.current-task.update', $game), ['task_id' => $next->id])
        ->assertNoContent();

    expect($second->fresh()->revealed_at)->toBeNull()
        ->and($table['task']->fresh()->estimate)->toBe('5');

    $players = [$table['facilitatorPlayer'], $table['memberPlayer'], $table['guest']];

    foreach (pokerViewers($table) as [$viewer, $viewerPlayer]) {
        foreach (pokerSurfacesFor($this, $table, $viewer, $viewerPlayer) as $surface => $payload) {
            foreach ($players as $player) {
                if ($player->id === $viewerPlayer->id) {
                    continue;
                }

                expect(pokerPayloadExposes($payload, $player, $table['values'][$player->id]))->toBeFalse("{$surface} exposes {$player->id}")
                    ->and(pokerPayloadMentions($payload, $table['values'][$player->id]))->toBeFalse("{$surface} mentions a hidden value");
            }
        }
    }
});
```

Notes for the implementer:
- Values `8`, `13`, `3` are all Fibonacci cards; they appear in `game.cards` as plain strings (`"8"`), which is why the checks look only for `"value":"…"`, `"myVote":"…"` and `"playerId":"…","value":"…"` fragments, never for the bare number.
- `pokerSurfacesFor()` calls `pokerViewerRequest()` before each request because `actingAs` persists on the test case; a guest request first forgets the resolved guards so it is really anonymous (the guest cookie stays set for later member requests, which is harmless: team members resolve as themselves first).
- In the third test the reveal of round 1 shows `5` for the facilitator and the member — those are the round-1 values and not checked; the checked values (`8`, `13`, `3`) belong only to the never-revealed round 2.

- [ ] **Step 2: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerRedactionTest.php`
Expected: PASS. If an assertion fails, the message names the surface; fix the presenter or controller that produced it (never the test), rerun, and commit the fix separately:

```bash
git commit -m "fix: keep hidden poker values out of <surface>

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

- [ ] **Step 3: Run the whole poker suite**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker tests/Unit/Poker`
Expected: PASS.

- [ ] **Step 4: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add tests/Feature/Poker/PokerRedactionTest.php
git commit -m "test: prove no poker card value leaks before reveal on any surface

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 13: Frontend foundation (types, reducer, channel, game hook, context)

**Files:**
- Create: `resources/js/lib/poker/types.ts`, `resources/js/lib/poker/game-reducer.ts`, `resources/js/lib/poker/format.ts`, `resources/js/hooks/use-poker-channel.ts`, `resources/js/hooks/use-poker-game.ts`, `resources/js/components/poker/game-context.tsx`, `resources/js/types/poker.ts`
- Modify: `resources/js/types/index.ts` (re-export `./poker`)

**Interfaces:**
- Consumes: `retroRequest`, `RetroRequestError` (`@/lib/retro/api`), `useSafeConnectionStatus` (`@/hooks/use-retro-channel`), `PresenceMember` (`@/lib/retro/types`), `WhisperChannel` (`@/lib/retro/whisper-transport`), `useServerOffset` (`@/hooks/use-countdown`), Wayfinder `PokerSnapshotsController` (Task 5).
- Produces: the exact types, reducer actions, hooks and context listed below. Plan 10b appends `'timer.changed'` to `PokerEvents`, a `timer.set` reducer action and an optional `onLeaving` handler; Plan 10b Task 6 moves the `WhisperChannel` import to `@/lib/realtime/whisper-transport`.

There is no JavaScript test runner in this repository: this task is verified by the type checker and the linter, and exercised by the UI tasks that follow.

- [ ] **Step 1: Poker types**

Create `resources/js/lib/poker/types.ts`:

```ts
export type PokerRevealReason = 'manual' | 'everyone_voted' | 'timer';

export type PokerResult = {
    average: number | null;
    distribution: { value: string; count: number }[];
    mode: string[];
    consensus: boolean;
    nearestCard: string | null;
};

export type PokerRoundVote = { playerId: string; value: string | null };

export type PokerRound = {
    id: string;
    number: number;
    anonymous: boolean;
    revealedAt: string | null;
    revealReason: PokerRevealReason | null;
    timerEndsAt: string | null;
    version: number;
    votesCount: number;
    votes: PokerRoundVote[];
    myVote: string | null;
    result: PokerResult | null;
};

export type PokerTask = {
    id: string;
    title: string;
    description: string | null;
    descriptionHtml: string;
    position: number;
    estimate: string | null;
    estimatedAt: string | null;
    roundsCount: number;
    external: null;
};

export type PokerPlayer = {
    id: string;
    name: string;
    avatarUrl: string;
    isGuest: boolean;
    isSpectator: boolean;
};

export type PokerGame = {
    id: string;
    title: string;
    deck: string;
    deckLabel: string;
    cards: string[];
    isNumeric: boolean;
    facilitatorPlayerId: string | null;
    guestAccessEnabled: boolean;
    guestUrl: string | null;
    endedAt: string | null;
    currentTaskId: string | null;
    tasksCount: number;
    estimatedCount: number;
    totalPoints: number | null;
    hasVotes: boolean;
    autoReveal: boolean;
    anonymousVotes: boolean;
    cursorsEnabled: boolean;
    reactionsEnabled: boolean;
};

export type PokerMe = {
    playerId: string;
    userId: string | null;
    isGuest: boolean;
    isFacilitator: boolean;
    isSpectator: boolean;
    canVote: boolean;
    canEditTasks: boolean;
    canTakeControl: boolean;
    canDelete: boolean;
    transferCandidates: { userId: string; name: string }[];
};

export type PokerCurrent = { taskId: string; round: PokerRound };

export type PokerSnapshot = {
    game: PokerGame;
    me: PokerMe;
    players: PokerPlayer[];
    tasks: PokerTask[];
    current: PokerCurrent | null;
    links: { team: string | null };
    serverTime: string;
};

export type PokerVoteResponse = {
    roundId: string;
    myVote: string | null;
    votesCount: number;
    version: number;
    revealed: boolean;
};

export const SpecialCards: readonly string[] = ['?', '☕'];

export function isSpecialCard(card: string): boolean {
    return SpecialCards.includes(card);
}
```

- [ ] **Step 2: Page prop types**

Create `resources/js/types/poker.ts`:

```ts
import type { PokerRound } from '@/lib/poker/types';

export type PokerDeckOption = { value: string; label: string; cards: string[] };

export type PokerGameSummary = {
    id: string;
    title: string;
    deckLabel: string;
    tasksCount: number;
    estimatedCount: number;
    totalPoints: number | null;
    endedAt: string | null;
    lastActivityAt: string;
};

export type EstimatedTaskRow = {
    id: string;
    title: string;
    gameId: string;
    gameTitle: string;
    estimate: string;
    roundsCount: number;
    estimatedAt: string;
    rounds: PokerRound[];
    players: { id: string; name: string }[];
};
```

In `resources/js/types/index.ts` append the line:

```ts
export type * from './poker';
```

- [ ] **Step 3: Formatting helpers**

Create `resources/js/lib/poker/format.ts`:

```ts
export function formatAverage(value: number, locale: string): string {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
        value,
    );
}

export function formatPoints(value: number, locale: string): string {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
        value,
    );
}
```

- [ ] **Step 4: The reducer**

Create `resources/js/lib/poker/game-reducer.ts`:

```ts
import type {
    PokerPlayer,
    PokerRound,
    PokerRoundVote,
    PokerSnapshot,
    PokerTask,
    PokerVoteResponse,
} from './types';

export type GameAction =
    | { type: 'replace'; snapshot: PokerSnapshot }
    | { type: 'task.upsert'; task: PokerTask }
    | { type: 'task.remove'; taskId: string }
    | { type: 'tasks.reorder'; taskIds: string[] }
    | {
          type: 'vote.changed';
          roundId: string;
          playerId: string;
          hasVoted: boolean;
          votesCount: number;
          version: number;
      }
    | { type: 'vote.mine'; response: PokerVoteResponse };

export function sortedTasks(tasks: PokerTask[]): PokerTask[] {
    return [...tasks].sort((first, second) => first.position - second.position);
}

/**
 * The next task still to estimate after the current one, in list order,
 * wrapping around; the current task itself is never proposed.
 */
export function nextUnestimatedTask(snapshot: PokerSnapshot): PokerTask | null {
    const tasks = sortedTasks(snapshot.tasks);
    const currentIndex = tasks.findIndex(
        (task) => task.id === snapshot.current?.taskId,
    );
    const ordered =
        currentIndex === -1
            ? tasks
            : [
                  ...tasks.slice(currentIndex + 1),
                  ...tasks.slice(0, currentIndex),
              ];

    return ordered.find((task) => task.estimate === null) ?? null;
}

function withTasks(state: PokerSnapshot, tasks: PokerTask[]): PokerSnapshot {
    const ordered = sortedTasks(tasks);

    return {
        ...state,
        tasks: ordered,
        game: {
            ...state.game,
            tasksCount: ordered.length,
            estimatedCount: ordered.filter((task) => task.estimate !== null)
                .length,
        },
    };
}

function withRound(
    state: PokerSnapshot,
    roundId: string,
    update: (round: PokerRound) => PokerRound,
): PokerSnapshot {
    if (!state.current || state.current.round.id !== roundId) {
        return state;
    }

    return {
        ...state,
        current: { ...state.current, round: update(state.current.round) },
    };
}

/** Voters are listed in join order, like the server does. */
function inPlayerOrder(
    votes: PokerRoundVote[],
    players: PokerPlayer[],
): PokerRoundVote[] {
    const order = new Map(players.map((player, index) => [player.id, index]));

    return [...votes].sort(
        (first, second) =>
            (order.get(first.playerId) ?? players.length) -
            (order.get(second.playerId) ?? players.length),
    );
}

export function gameReducer(
    state: PokerSnapshot,
    action: GameAction,
): PokerSnapshot {
    switch (action.type) {
        case 'replace':
            return action.snapshot;
        case 'task.upsert':
            return withTasks(state, [
                ...state.tasks.filter((task) => task.id !== action.task.id),
                action.task,
            ]);
        case 'task.remove': {
            const next = withTasks(
                state,
                state.tasks.filter((task) => task.id !== action.taskId),
            );

            if (state.current?.taskId !== action.taskId) {
                return next;
            }

            return {
                ...next,
                current: null,
                game: { ...next.game, currentTaskId: null },
            };
        }
        case 'tasks.reorder': {
            const byId = new Map(state.tasks.map((task) => [task.id, task]));
            const listed = action.taskIds.flatMap((id) => {
                const task = byId.get(id);

                return task ? [task] : [];
            });
            const unlisted = state.tasks.filter(
                (task) => !action.taskIds.includes(task.id),
            );

            return withTasks(
                state,
                [...listed, ...sortedTasks(unlisted)].map((task, index) => ({
                    ...task,
                    position: index + 1,
                })),
            );
        }
        case 'vote.changed':
            return withRound(state, action.roundId, (round) => {
                if (action.version <= round.version) {
                    return round;
                }

                const others = round.votes.filter(
                    (vote) => vote.playerId !== action.playerId,
                );
                const known = round.votes.find(
                    (vote) => vote.playerId === action.playerId,
                );
                const votes = action.hasVoted
                    ? inPlayerOrder(
                          [
                              ...others,
                              known ?? {
                                  playerId: action.playerId,
                                  value: null,
                              },
                          ],
                          state.players,
                      )
                    : others;

                return {
                    ...round,
                    votes,
                    votesCount: action.votesCount,
                    version: action.version,
                };
            });
        case 'vote.mine': {
            const { response } = action;
            const playerId = state.me.playerId;

            return withRound(state, response.roundId, (round) => {
                const others = round.votes.filter(
                    (vote) => vote.playerId !== playerId,
                );
                const votes =
                    response.myVote === null
                        ? others
                        : inPlayerOrder(
                              [
                                  ...others,
                                  { playerId, value: response.myVote },
                              ],
                              state.players,
                          );
                const isCurrent = response.version >= round.version;

                return {
                    ...round,
                    votes,
                    myVote: response.myVote,
                    votesCount: isCurrent
                        ? response.votesCount
                        : round.votesCount,
                    version: isCurrent ? response.version : round.version,
                };
            });
        }
    }
}
```

The viewer's own value is always taken from `vote.mine` (only this client knows it); the count and version only when the response is not older than what a broadcast already brought.

- [ ] **Step 5: The presence channel hook**

Create `resources/js/hooks/use-poker-channel.ts`:

```ts
import { echo, echoIsConfigured } from '@laravel/echo-react';
import { useEffect, useRef, useState } from 'react';
import type { PresenceMember } from '@/lib/retro/types';
import type { WhisperChannel } from '@/lib/retro/whisper-transport';
import { useSafeConnectionStatus } from './use-retro-channel';

export const PokerEvents = [
    'task.saved',
    'task.deleted',
    'tasks.reordered',
    'vote.changed',
    'round.changed',
    'game.changed',
    'game.deleted',
] as const;

/**
 * The presence subscription completes moments after the socket (on load
 * and on every reconnect); waiting briefly lets one snapshot cover both.
 */
const ResyncCoalesceMs = 250;

export type PokerEventName = (typeof PokerEvents)[number];

export type PokerEvent = {
    name: PokerEventName;
    payload: Record<string, unknown>;
};

export type PokerChannelHandlers = {
    onEvent: (event: PokerEvent) => void;
    onResync: () => void;
    onJoining: (member: PresenceMember) => void;
};

/** A player open in two tabs is one presence member with the same id. */
function withMember(
    members: PresenceMember[],
    member: PresenceMember,
): PresenceMember[] {
    return [...members.filter((known) => known.id !== member.id), member];
}

function uniqueMembers(members: PresenceMember[]): PresenceMember[] {
    return members.reduce<PresenceMember[]>(withMember, []);
}

export function usePokerChannel(
    gameId: string,
    enabled: boolean,
    channelHandlers: PokerChannelHandlers,
) {
    const [online, setOnline] = useState<PresenceMember[]>([]);
    const [presence, setPresence] = useState<WhisperChannel | null>(null);
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

        const name = `poker.${gameId}`;
        const channel = echo<'reverb'>()
            .join(name)
            .here((members: PresenceMember[]) => {
                setOnline(uniqueMembers(members));
                scheduleResync();
            })
            .joining((member: PresenceMember) => {
                setOnline((current) => withMember(current, member));
                handlers.current.onJoining(member);
            })
            .leaving((member: PresenceMember) =>
                setOnline((current) =>
                    current.filter((known) => known.id !== member.id),
                ),
            )
            .error(scheduleResync);

        setPresence(channel as unknown as WhisperChannel);

        for (const event of PokerEvents) {
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
    }, [gameId, enabled]);

    const connected = status === 'connected';
    const reconnecting = status === 'failed' || (wasConnected && !connected);

    return { online, connected, reconnecting, presence };
}
```

- [ ] **Step 6: The game hook**

Create `resources/js/hooks/use-poker-game.ts`:

```ts
import { useCallback, useReducer, useRef, useState, type Dispatch } from 'react';
import { toast } from 'sonner';
import PokerSnapshotsController from '@/actions/App/Http/Controllers/Poker/PokerSnapshotsController';
import { useServerOffset } from '@/hooks/use-countdown';
import { useTrans } from '@/hooks/use-trans';
import { gameReducer, type GameAction } from '@/lib/poker/game-reducer';
import type { PokerSnapshot, PokerTask } from '@/lib/poker/types';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { PresenceMember } from '@/lib/retro/types';
import type { WhisperChannel } from '@/lib/retro/whisper-transport';
import { usePokerChannel, type PokerEvent } from './use-poker-channel';

const SessionExpiredStatuses = [401, 419];

export type GameStatus = 'active' | 'ended' | 'deleted';

export type PokerGameState = {
    snapshot: PokerSnapshot;
    dispatch: Dispatch<GameAction>;
    apply: (action: GameAction) => void;
    refetch: () => Promise<void>;
    run: <T>(mutation: Promise<T>) => Promise<T | undefined>;
    handleError: (error: unknown) => string | null;
    status: GameStatus;
    online: PresenceMember[];
    connected: boolean;
    reconnecting: boolean;
    presence: WhisperChannel | null;
    sessionExpired: boolean;
    serverOffset: number;
};

export function usePokerGame(initial: PokerSnapshot): PokerGameState {
    const { t } = useTrans();
    const [snapshot, dispatch] = useReducer(gameReducer, initial);
    const [status, setStatus] = useState<GameStatus>('active');
    const [sessionExpired, setSessionExpired] = useState(false);
    const isActive = useRef(true);
    const latestRefetch = useRef(0);
    const bufferedActions = useRef<GameAction[] | null>(null);
    const latestSnapshot = useRef(snapshot);
    const gameId = initial.game.id;
    const serverOffset = useServerOffset(snapshot.serverTime);

    latestSnapshot.current = snapshot;

    /**
     * While a refetch is in flight, broadcast actions are held back and
     * replayed after its snapshot so events committed after the snapshot
     * was built are not wiped by it.
     */
    const apply = useCallback((action: GameAction) => {
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

    const end = useCallback((reason: Exclude<GameStatus, 'active'>) => {
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
            const fresh = await retroRequest<PokerSnapshot>(
                PokerSnapshotsController.show(gameId),
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
    }, [gameId, end, flushBufferedActions]);

    const onEvent = useCallback(
        ({ name, payload }: PokerEvent) => {
            switch (name) {
                case 'task.saved':
                    apply({
                        type: 'task.upsert',
                        task: payload.task as PokerTask,
                    });
                    break;
                case 'task.deleted':
                    apply({
                        type: 'task.remove',
                        taskId: payload.taskId as string,
                    });
                    break;
                case 'tasks.reordered':
                    apply({
                        type: 'tasks.reorder',
                        taskIds: payload.taskIds as string[],
                    });
                    break;
                case 'vote.changed':
                    if (
                        payload.playerId ===
                        latestSnapshot.current.me.playerId
                    ) {
                        void refetch();
                        break;
                    }

                    apply({
                        type: 'vote.changed',
                        roundId: payload.roundId as string,
                        playerId: payload.playerId as string,
                        hasVoted: payload.hasVoted as boolean,
                        votesCount: payload.votesCount as number,
                        version: payload.version as number,
                    });
                    break;
                case 'round.changed':
                case 'game.changed':
                    void refetch();
                    break;
                case 'game.deleted':
                    end('deleted');
                    break;
            }
        },
        [apply, refetch, end],
    );

    const onJoining = useCallback(
        (member: PresenceMember) => {
            const isKnown = latestSnapshot.current.players.some(
                (player) => player.id === member.id,
            );

            if (!isKnown) {
                void refetch();
            }
        },
        [refetch],
    );

    const { online, connected, reconnecting, presence } = usePokerChannel(
        gameId,
        status === 'active',
        { onEvent, onResync: refetch, onJoining },
    );

    const errorMessage = useCallback(
        (error: unknown): string => {
            if (!(error instanceof RetroRequestError)) {
                return t('Something went wrong. Please try again.');
            }

            if (error.status === 0) {
                return t(
                    'The server did not respond in time. Please try again.',
                );
            }

            return (
                error.message || t('Something went wrong. Please try again.')
            );
        },
        [t],
    );

    /**
     * Shows the session-expired banner for a 401/419 and returns null;
     * otherwise returns the translated message to show for the failure.
     */
    const handleError = useCallback(
        (error: unknown): string | null => {
            if (
                error instanceof RetroRequestError &&
                SessionExpiredStatuses.includes(error.status)
            ) {
                setSessionExpired(true);

                return null;
            }

            return errorMessage(error);
        },
        [errorMessage],
    );

    /**
     * Every failed mutation (a closed round, a task deleted meanwhile, a
     * role changed by the facilitator) is followed by a fresh snapshot so
     * the screen shows the state the server refused against.
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
        snapshot,
        dispatch,
        apply,
        refetch,
        run,
        handleError,
        status,
        online,
        connected,
        reconnecting,
        presence,
        sessionExpired,
        serverOffset,
    };
}
```

- [ ] **Step 7: The game context**

Create `resources/js/components/poker/game-context.tsx`:

```tsx
import {
    createContext,
    useContext,
    type Dispatch,
    type ReactNode,
} from 'react';
import type { GameAction } from '@/lib/poker/game-reducer';
import type { PokerSnapshot } from '@/lib/poker/types';
import type { PresenceMember } from '@/lib/retro/types';
import type { WhisperChannel } from '@/lib/retro/whisper-transport';
import type { PokerDeckOption } from '@/types';

export type GameContextValue = {
    snapshot: PokerSnapshot;
    dispatch: Dispatch<GameAction>;
    apply: (action: GameAction) => void;
    run: <T>(mutation: Promise<T>) => Promise<T | undefined>;
    handleError: (error: unknown) => string | null;
    refetch: () => Promise<void>;
    sessionExpired: boolean;
    online: PresenceMember[];
    presence: WhisperChannel | null;
    serverOffset: number;
    deckOptions: PokerDeckOption[];
};

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({
    value,
    children,
}: {
    value: GameContextValue;
    children: ReactNode;
}) {
    return <GameContext value={value}>{children}</GameContext>;
}

export function useGame(): GameContextValue {
    const value = useContext(GameContext);

    if (!value) {
        throw new Error('useGame() must be used inside <GameProvider>.');
    }

    return value;
}
```

- [ ] **Step 8: Type-check, lint and format**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form` (so `@/actions/App/Http/Controllers/Poker/PokerSnapshotsController` exists), then `npx vp check --fix resources/js/lib/poker resources/js/hooks/use-poker-channel.ts resources/js/hooks/use-poker-game.ts resources/js/components/poker/game-context.tsx resources/js/types/poker.ts resources/js/types/index.ts` and `npm run types:check && npm run check`.
Expected: no type errors; `check` reports only the known pre-existing failures (`.devcontainer/devcontainer.json`, `docs/superpowers/*.md`).

- [ ] **Step 9: Commit**

```bash
git add resources/js/lib/poker/types.ts resources/js/lib/poker/game-reducer.ts resources/js/lib/poker/format.ts resources/js/hooks/use-poker-channel.ts resources/js/hooks/use-poker-game.ts resources/js/components/poker/game-context.tsx resources/js/types/poker.ts resources/js/types/index.ts
git commit -m "feat: add the planning poker client state, channel and game hook

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

### Task 14: Game page shell, tasks pane and task detail

**Files:**
- Create: `resources/js/components/poker/{game,game-header,game-gone,take-control-button,tasks-pane,task-form-dialog,task-detail,round-history}.tsx`; null stubs `resources/js/components/poker/{players-grid,hand,facilitator-toolbar,result-panel,game-menu}.tsx` (bodies replaced by Tasks 15 and 16)
- Modify: `resources/js/pages/poker/show.tsx` (final), `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: Task 13 (`usePokerGame`, `GameProvider`/`useGame`, `sortedTasks`, types); `PresenceStrip`, `ConnectionBanner`, `SessionExpiredBanner` (`@/components/retro/…`); `LanguageSwitcher` (`@/components/language-switcher`); Wayfinder `Poker/PokerTasksController` (`store`, `update`, `destroy`), `Poker/PokerTaskOrdersController.update`, `Poker/PokerCurrentTasksController.update`, `Poker/PokerRoundsController.index`, `Poker/PokerFacilitatorsController.update`, `Poker/PokerSettingsController.update` — all generated after Tasks 5–10.
- Produces:
  - `Game({ snapshot, deckOptions }: { snapshot: PokerSnapshot; deckOptions: PokerDeckOption[] })` — provider, header, connection banner, tasks pane (desktop aside `lg:w-80`, collapsible; `Sheet` drawer below `lg`), and `<main ref={setMainPane} className="relative flex min-w-0 flex-1 flex-col gap-4 overflow-auto p-4">` with the table (`PlayersGrid`, `FacilitatorToolbar`, `ResultPanel` when revealed, `TaskDetail`) and the `Hand` last. Plan 10b reads `mainPane` (the state is declared as `const [, setMainPane]` here; 10b renames the first element to `mainPane`).
  - `GameHeader({ actions }: { actions?: ReactNode })`, `GameGone({ reason, teamUrl })`, `TakeControlButton()`, `TasksPane({ onSelected }: { onSelected?: () => void })`, `TaskFormDialog({ task, open, onOpenChange })`, `TaskDetail({ task })`, `RoundHistory({ taskId })`, `MarkdownClasses` (exported class string for server-rendered Markdown).
  - Stubs (exact signatures kept by Tasks 15/16): `PlayersGrid()`, `Hand()`, `FacilitatorToolbar()`, `ResultPanel({ round }: { round: PokerRound })`, `GameMenu()`.
- `RoundHistory` expects `GET poker.tasks.rounds.index` to answer a plain JSON array of rounds (newest first), as Task 9's controller returns `response()->json([...])`.

No JavaScript test runner exists; verification is types, lint and a manual check in the browser.

- [ ] **Step 1: Stubs for the table and the facilitator menu**

Create `resources/js/components/poker/players-grid.tsx`:

```tsx
export function PlayersGrid() {
    return null;
}
```

Create `resources/js/components/poker/hand.tsx`:

```tsx
export function Hand() {
    return null;
}
```

Create `resources/js/components/poker/facilitator-toolbar.tsx`:

```tsx
export function FacilitatorToolbar() {
    return null;
}
```

Create `resources/js/components/poker/result-panel.tsx`:

```tsx
import type { PokerRound } from '@/lib/poker/types';

type Props = { round: PokerRound };

export function ResultPanel(props: Props) {
    void props;

    return null;
}
```

Create `resources/js/components/poker/game-menu.tsx`:

```tsx
export function GameMenu() {
    return null;
}
```

- [ ] **Step 2: "Game gone" and "Take control"**

Create `resources/js/components/poker/game-gone.tsx`:

```tsx
import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export function GameGone({
    reason,
    teamUrl,
}: {
    reason: 'ended' | 'deleted';
    teamUrl: string | null;
}) {
    const { t } = useTrans();

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-lg">
                {reason === 'deleted'
                    ? t('This game was deleted.')
                    : t('Your access to this game has ended.')}
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

Create `resources/js/components/poker/take-control-button.tsx`:

```tsx
import { Hand as HandIcon } from 'lucide-react';
import { useState } from 'react';
import PokerFacilitatorsController from '@/actions/App/Http/Controllers/Poker/PokerFacilitatorsController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';

export function TakeControlButton() {
    const { snapshot, run, refetch } = useGame();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { me, game } = snapshot;

    if (!me.canTakeControl || me.userId === null) {
        return null;
    }

    const takeControl = async () => {
        setBusy(true);

        const result = await run(
            retroRequest(PokerFacilitatorsController.update(game.id), {
                user_id: me.userId,
            }),
        );

        setBusy(false);

        if (result !== undefined) {
            await refetch();
        }
    };

    return (
        <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void takeControl()}
        >
            <HandIcon className="size-4" />
            {t('Take control')}
        </Button>
    );
}
```

- [ ] **Step 3: The header**

Create `resources/js/components/poker/game-header.tsx`:

```tsx
import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import PokerSettingsController from '@/actions/App/Http/Controllers/Poker/PokerSettingsController';
import { LanguageSwitcher } from '@/components/language-switcher';
import { PresenceStrip } from '@/components/retro/presence-strip';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';
import { GameMenu } from './game-menu';
import { TakeControlButton } from './take-control-button';

type Props = { actions?: ReactNode };

export function GameHeader({ actions }: Props) {
    const { snapshot, online } = useGame();
    const { t } = useTrans();
    const { game, me, links } = snapshot;
    const isEnded = game.endedAt !== null;

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
            {me.isFacilitator && !isEnded ? (
                <TitleEditor key={game.title} />
            ) : (
                <h1 className="text-lg font-semibold">{game.title}</h1>
            )}
            <Badge variant="outline">{game.deckLabel}</Badge>
            {isEnded && <Badge variant="secondary">{t('Game ended')}</Badge>}
            <div className="ml-auto flex flex-wrap items-center gap-3">
                {actions}
                <TakeControlButton />
                {(me.isFacilitator || me.canDelete) && <GameMenu />}
                <PresenceStrip members={online} />
                {me.isGuest && <LanguageSwitcher />}
            </div>
        </header>
    );
}

function TitleEditor() {
    const { snapshot, run, refetch } = useGame();
    const { t } = useTrans();
    const [value, setValue] = useState(snapshot.game.title);

    const save = async () => {
        const title = value.trim();

        if (title === '' || title === snapshot.game.title) {
            setValue(snapshot.game.title);

            return;
        }

        const result = await run(
            retroRequest(PokerSettingsController.update(snapshot.game.id), {
                title,
            }),
        );

        if (result !== undefined) {
            await refetch();
        }
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.currentTarget.blur();
        }

        if (event.key === 'Escape') {
            setValue(snapshot.game.title);
            event.currentTarget.blur();
        }
    };

    return (
        <h1 className="min-w-0">
            <Input
                value={value}
                maxLength={120}
                aria-label={t('Game title')}
                className="h-8 w-64 max-w-full border-transparent text-lg font-semibold shadow-none hover:border-input"
                onChange={(event) => setValue(event.target.value)}
                onBlur={() => void save()}
                onKeyDown={onKeyDown}
            />
        </h1>
    );
}
```

- [ ] **Step 4: Round history**

Create `resources/js/components/poker/round-history.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { usePage } from '@inertiajs/react';
import PokerRoundsController from '@/actions/App/Http/Controllers/Poker/PokerRoundsController';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrans } from '@/hooks/use-trans';
import { formatAverage } from '@/lib/poker/format';
import type { PokerRound } from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';

type Loaded =
    | { state: 'loading' }
    | { state: 'failed' }
    | { state: 'ready'; rounds: PokerRound[] };

export function RoundHistory({ taskId }: { taskId: string }) {
    const { snapshot, handleError } = useGame();
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
    const task = snapshot.tasks.find((candidate) => candidate.id === taskId);
    const currentRound =
        snapshot.current?.taskId === taskId ? snapshot.current.round : null;
    const revision = `${task?.roundsCount ?? 0}:${currentRound?.id ?? ''}:${currentRound?.revealedAt ?? ''}`;
    const gameId = snapshot.game.id;

    useEffect(() => {
        let isCurrent = true;

        retroRequest<PokerRound[]>(
            PokerRoundsController.index({ game: gameId, task: taskId }),
        )
            .then((rounds) => {
                if (isCurrent) {
                    setLoaded({ state: 'ready', rounds });
                }
            })
            .catch((error: unknown) => {
                if (isCurrent) {
                    handleError(error);
                    setLoaded({ state: 'failed' });
                }
            });

        return () => {
            isCurrent = false;
        };
    }, [gameId, taskId, revision, handleError]);

    if (loaded.state === 'loading') {
        return <Skeleton className="h-16 w-full" />;
    }

    if (loaded.state === 'failed') {
        return (
            <p className="text-sm text-destructive">
                {t('Could not load the rounds.')}
            </p>
        );
    }

    if (loaded.rounds.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                {t('No rounds yet.')}
            </p>
        );
    }

    const nameOf = (playerId: string) =>
        snapshot.players.find((player) => player.id === playerId)?.name ??
        t('Former member');

    return (
        <ol className="space-y-3">
            {loaded.rounds.map((round) => (
                <li key={round.id} className="rounded-md border p-3 text-sm">
                    <div className="font-medium">
                        {t('Round :number', { number: round.number })}
                    </div>
                    {round.revealedAt === null ? (
                        <p className="text-muted-foreground">
                            {t('Not revealed · :count votes', {
                                count: round.votesCount,
                            })}
                        </p>
                    ) : (
                        <>
                            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                                {round.votes.map((vote) => (
                                    <li key={vote.playerId}>
                                        {nameOf(vote.playerId)}:{' '}
                                        <span className="font-mono font-semibold">
                                            {vote.value ?? '—'}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            {round.result && (
                                <p className="mt-1 text-muted-foreground">
                                    {round.result.average !== null
                                        ? `${t('Average')}: ${formatAverage(round.result.average, locale)}`
                                        : round.result.mode.length > 0
                                          ? t('Most played: :cards', {
                                                cards: round.result.mode.join(
                                                    ', ',
                                                ),
                                            })
                                          : t('No countable votes')}
                                    {round.result.consensus &&
                                        ` · ${t('Consensus')}`}
                                </p>
                            )}
                        </>
                    )}
                </li>
            ))}
        </ol>
    );
}
```

`Average`, `Most played: :cards`, `No countable votes` and `Consensus` are added by Task 15; this task adds them too if Task 15 has not run yet (translation rows below), so the translation test stays green whichever lands first.

- [ ] **Step 5: Task form dialog**

Create `resources/js/components/poker/task-form-dialog.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import PokerTasksController from '@/actions/App/Http/Controllers/Poker/PokerTasksController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import type { PokerTask } from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import { useGame } from './game-context';
import { MarkdownClasses } from './task-detail';

type Props = {
    task: PokerTask | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function TaskFormDialog({ task, open, onOpenChange }: Props) {
    const { t } = useTrans();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-2xl">
                <DialogTitle>{task ? t('Edit task') : t('Add task')}</DialogTitle>
                {open && (
                    <TaskForm task={task} onDone={() => onOpenChange(false)} />
                )}
            </DialogContent>
        </Dialog>
    );
}

function TaskForm({
    task,
    onDone,
}: {
    task: PokerTask | null;
    onDone: () => void;
}) {
    const { snapshot, apply, run } = useGame();
    const { t } = useTrans();
    const [title, setTitle] = useState(task?.title ?? '');
    const [description, setDescription] = useState(task?.description ?? '');
    const [tab, setTab] = useState<'write' | 'preview'>('write');
    const [busy, setBusy] = useState(false);
    const gameId = snapshot.game.id;
    const savedHtml =
        task && (task.description ?? '') === description
            ? task.descriptionHtml
            : null;

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);

        const payload = {
            title: title.trim(),
            description: description.trim() === '' ? null : description,
        };
        const saved = await run(
            retroRequest<PokerTask>(
                task
                    ? PokerTasksController.update({
                          game: gameId,
                          task: task.id,
                      })
                    : PokerTasksController.store(gameId),
                payload,
            ),
        );

        setBusy(false);

        if (saved) {
            apply({ type: 'task.upsert', task: saved });
            onDone();
        }
    };

    return (
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
            <div className="grid gap-2">
                <Label htmlFor="poker-task-title">{t('Title')}</Label>
                <Input
                    id="poker-task-title"
                    required
                    maxLength={200}
                    autoFocus
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                />
            </div>

            <div className="grid gap-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="poker-task-description">
                        {t('Description')}
                    </Label>
                    <div role="tablist" className="flex gap-1">
                        {(['write', 'preview'] as const).map((name) => (
                            <Button
                                key={name}
                                type="button"
                                role="tab"
                                size="sm"
                                variant={tab === name ? 'secondary' : 'ghost'}
                                aria-selected={tab === name}
                                onClick={() => setTab(name)}
                            >
                                {name === 'write' ? t('Write') : t('Preview')}
                            </Button>
                        ))}
                    </div>
                </div>
                {tab === 'write' ? (
                    <>
                        <Textarea
                            id="poker-task-description"
                            rows={8}
                            maxLength={10000}
                            value={description}
                            onChange={(event) =>
                                setDescription(event.target.value)
                            }
                        />
                        <p className="text-xs text-muted-foreground">
                            {t('Markdown is supported.')}
                        </p>
                    </>
                ) : savedHtml !== null && savedHtml !== '' ? (
                    <div
                        className={cn(
                            MarkdownClasses,
                            'min-h-24 rounded-md border p-3',
                        )}
                        dangerouslySetInnerHTML={{ __html: savedHtml }}
                    />
                ) : (
                    <p className="min-h-24 rounded-md border p-3 text-sm text-muted-foreground">
                        {t('Save to preview')}
                    </p>
                )}
            </div>

            <DialogFooter className="gap-2">
                <Button type="button" variant="secondary" onClick={onDone}>
                    {t('Cancel')}
                </Button>
                <Button disabled={busy || title.trim() === ''}>
                    {t('Save')}
                </Button>
            </DialogFooter>
        </form>
    );
}
```

The preview only ever shows HTML the server rendered with `RenderTaskMarkdown` (spec §5): unsaved text is not rendered client-side.

- [ ] **Step 6: Task detail**

Create `resources/js/components/poker/task-detail.tsx`:

```tsx
import { ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import PokerTasksController from '@/actions/App/Http/Controllers/Poker/PokerTasksController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import type { PokerTask } from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';
import { RoundHistory } from './round-history';
import { TaskFormDialog } from './task-form-dialog';

/**
 * The app has no typography plugin; these descendant styles give the
 * server-rendered Markdown readable defaults.
 */
export const MarkdownClasses =
    'space-y-2 text-sm break-words [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_h1]:text-base [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5';

export function TaskDetail({ task }: { task: PokerTask }) {
    const { snapshot, apply, run } = useGame();
    const { t } = useTrans();
    const [editing, setEditing] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [busy, setBusy] = useState(false);
    const { game, me } = snapshot;
    const isEnded = game.endedAt !== null;

    const destroy = async () => {
        setBusy(true);

        const result = await run(
            retroRequest(
                PokerTasksController.destroy({ game: game.id, task: task.id }),
            ),
        );

        setBusy(false);

        if (result !== undefined) {
            setConfirmingDelete(false);
            apply({ type: 'task.remove', taskId: task.id });
        }
    };

    return (
        <section
            aria-labelledby={`poker-task-${task.id}`}
            className="space-y-3 rounded-md border p-4"
        >
            <div className="flex flex-wrap items-start gap-2">
                <h2
                    id={`poker-task-${task.id}`}
                    className="min-w-0 flex-1 text-lg font-semibold break-words"
                >
                    {task.title}
                </h2>
                {task.estimate !== null && (
                    <Badge>{t('Estimate: :value', { value: task.estimate })}</Badge>
                )}
                {me.canEditTasks && !isEnded && (
                    <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t('Edit task')}
                        onClick={() => setEditing(true)}
                    >
                        <Pencil className="size-4" />
                    </Button>
                )}
                {me.isFacilitator && !isEnded && (
                    <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t('Delete task')}
                        onClick={() => setConfirmingDelete(true)}
                    >
                        <Trash2 className="size-4" />
                    </Button>
                )}
            </div>

            {task.descriptionHtml !== '' && (
                <div
                    className={MarkdownClasses}
                    dangerouslySetInnerHTML={{ __html: task.descriptionHtml }}
                />
            )}

            {task.roundsCount > 0 && (
                <Collapsible>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="group">
                            {t('Rounds (:count)', { count: task.roundsCount })}
                            <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                        <RoundHistory taskId={task.id} />
                    </CollapsibleContent>
                </Collapsible>
            )}

            <TaskFormDialog
                task={task}
                open={editing}
                onOpenChange={setEditing}
            />

            <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
                <DialogContent>
                    <DialogTitle>{t('Delete this task?')}</DialogTitle>
                    <DialogDescription>
                        {t('Its rounds and votes are deleted too.')}
                    </DialogDescription>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="secondary"
                            onClick={() => setConfirmingDelete(false)}
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
        </section>
    );
}
```

`RoundHistory` mounts only while the disclosure is open (`CollapsibleContent` unmounts closed content), so the history is fetched on demand.

- [ ] **Step 7: Tasks pane**

Create `resources/js/components/poker/tasks-pane.tsx`:

```tsx
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type Announcements,
    type DragEndEvent,
    type UniqueIdentifier,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import PokerCurrentTasksController from '@/actions/App/Http/Controllers/Poker/PokerCurrentTasksController';
import PokerTaskOrdersController from '@/actions/App/Http/Controllers/Poker/PokerTaskOrdersController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { sortedTasks } from '@/lib/poker/game-reducer';
import type { PokerTask } from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import { useGame } from './game-context';
import { TaskFormDialog } from './task-form-dialog';

type Props = { onSelected?: () => void };

export function TasksPane({ onSelected }: Props) {
    const { snapshot, apply, run, refetch } = useGame();
    const { t } = useTrans();
    const [adding, setAdding] = useState(false);
    const { game, me } = snapshot;
    const tasks = sortedTasks(snapshot.tasks);
    const isEnded = game.endedAt !== null;
    const canSort = me.isFacilitator && !isEnded;
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const select = async (task: PokerTask) => {
        if (!canSort || task.id === snapshot.current?.taskId) {
            onSelected?.();

            return;
        }

        const result = await run(
            retroRequest(PokerCurrentTasksController.update(game.id), {
                task_id: task.id,
            }),
        );

        if (result !== undefined) {
            await refetch();
        }

        onSelected?.();
    };

    const titleOf = (id: UniqueIdentifier | undefined): string =>
        tasks.find((task) => task.id === id)?.title ?? '';

    const announcements: Announcements = {
        onDragStart: ({ active }) =>
            t('Picked up :task.', { task: titleOf(active.id) }),
        onDragOver: ({ active, over }) =>
            over
                ? t('Moved :task to position :position.', {
                      task: titleOf(active.id),
                      position:
                          tasks.findIndex((task) => task.id === over.id) + 1,
                  })
                : undefined,
        onDragEnd: ({ active }) =>
            t('Dropped :task.', { task: titleOf(active.id) }),
        onDragCancel: () => t('Reordering cancelled.'),
    };

    const handleDragEnd = async ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) {
            return;
        }

        const ids = tasks.map((task) => task.id);
        const next = arrayMove(
            ids,
            ids.indexOf(String(active.id)),
            ids.indexOf(String(over.id)),
        );

        apply({ type: 'tasks.reorder', taskIds: next });

        await run(
            retroRequest(PokerTaskOrdersController.update(game.id), {
                task_ids: next,
            }),
        );
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-2 border-b p-3">
                <h2 className="font-semibold">
                    {t('Tasks')}{' '}
                    <span className="text-sm font-normal text-muted-foreground">
                        ({tasks.length})
                    </span>
                </h2>
                {me.canEditTasks && !isEnded && (
                    <Button size="sm" onClick={() => setAdding(true)}>
                        <Plus className="size-4" />
                        {t('Add task')}
                    </Button>
                )}
            </div>

            {tasks.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">
                    {t('No tasks yet.')}
                </p>
            ) : (
                <DndContext
                    id="poker-tasks"
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    accessibility={{
                        announcements,
                        screenReaderInstructions: {
                            draggable: t(
                                'To pick up a task, press Space or Enter. Use the arrow keys to move it, Space or Enter to drop it, or Escape to cancel.',
                            ),
                        },
                    }}
                    onDragEnd={(event) => void handleDragEnd(event)}
                >
                    <SortableContext
                        items={tasks.map((task) => task.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <ol className="flex-1 divide-y overflow-y-auto">
                            {tasks.map((task) => (
                                <TaskRow
                                    key={task.id}
                                    task={task}
                                    sortable={canSort}
                                    selectable={canSort}
                                    onSelect={() => void select(task)}
                                />
                            ))}
                        </ol>
                    </SortableContext>
                </DndContext>
            )}

            <TaskFormDialog task={null} open={adding} onOpenChange={setAdding} />
        </div>
    );
}

function TaskRow({
    task,
    sortable,
    selectable,
    onSelect,
}: {
    task: PokerTask;
    sortable: boolean;
    selectable: boolean;
    onSelect: () => void;
}) {
    const { snapshot } = useGame();
    const { t } = useTrans();
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id, disabled: !sortable });
    const isCurrent = snapshot.current?.taskId === task.id;
    const firstLine = task.description?.split('\n')[0]?.trim() ?? '';

    const content: ReactNode = (
        <>
            <span className="flex items-start gap-2">
                <span className="min-w-0 flex-1 font-medium break-words">
                    {task.title}
                </span>
                {task.estimate !== null && (
                    <Badge variant="secondary">{task.estimate}</Badge>
                )}
                {isCurrent && snapshot.current && (
                    <Badge>
                        {t('Votes: :count', {
                            count: snapshot.current.round.votesCount,
                        })}
                    </Badge>
                )}
            </span>
            {firstLine !== '' && (
                <span className="line-clamp-1 text-xs text-muted-foreground">
                    {firstLine}
                </span>
            )}
        </>
    );

    return (
        <li
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
            }}
            data-dragging={isDragging}
            aria-current={isCurrent ? 'true' : undefined}
            className={cn(
                'flex items-start gap-2 bg-background p-3 data-[dragging=true]:opacity-60',
                isCurrent && 'bg-accent',
            )}
        >
            {sortable && (
                <button
                    type="button"
                    ref={setActivatorNodeRef}
                    className="mt-0.5 cursor-grab text-muted-foreground"
                    aria-label={t('Drag to reorder')}
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="size-4" />
                </button>
            )}
            {selectable ? (
                <button
                    type="button"
                    className="flex min-w-0 flex-1 flex-col gap-1 text-left"
                    onClick={onSelect}
                >
                    {content}
                </button>
            ) : (
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {content}
                </div>
            )}
        </li>
    );
}
```

- [ ] **Step 8: The game shell**

Create `resources/js/components/poker/game.tsx`:

```tsx
import { ListTodo } from 'lucide-react';
import { useState } from 'react';
import { ConnectionBanner } from '@/components/retro/connection-banner';
import { SessionExpiredBanner } from '@/components/retro/session-expired-banner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { usePokerGame } from '@/hooks/use-poker-game';
import { useTrans } from '@/hooks/use-trans';
import type { PokerSnapshot } from '@/lib/poker/types';
import type { PokerDeckOption } from '@/types';
import { FacilitatorToolbar } from './facilitator-toolbar';
import { GameProvider, useGame, type GameContextValue } from './game-context';
import { GameGone } from './game-gone';
import { GameHeader } from './game-header';
import { Hand } from './hand';
import { PlayersGrid } from './players-grid';
import { ResultPanel } from './result-panel';
import { TaskDetail } from './task-detail';
import { TaskFormDialog } from './task-form-dialog';
import { TasksPane } from './tasks-pane';

type Props = { snapshot: PokerSnapshot; deckOptions: PokerDeckOption[] };

export function Game({ snapshot: initial, deckOptions }: Props) {
    const { t } = useTrans();
    const game = usePokerGame(initial);
    const [, setMainPane] = useState<HTMLElement | null>(null);
    const [tasksCollapsed, setTasksCollapsed] = useState(false);
    const [tasksOpen, setTasksOpen] = useState(false);

    if (game.status !== 'active') {
        return (
            <GameGone
                reason={game.status}
                teamUrl={game.snapshot.links.team}
            />
        );
    }

    const ctx: GameContextValue = {
        snapshot: game.snapshot,
        dispatch: game.dispatch,
        apply: game.apply,
        run: game.run,
        handleError: game.handleError,
        refetch: game.refetch,
        sessionExpired: game.sessionExpired,
        online: game.online,
        presence: game.presence,
        serverOffset: game.serverOffset,
        deckOptions,
    };

    return (
        <GameProvider value={ctx}>
            <div className="flex min-h-dvh flex-col">
                {game.sessionExpired && <SessionExpiredBanner />}
                <div
                    className="flex flex-1 flex-col"
                    inert={game.sessionExpired}
                >
                    <GameHeader
                        actions={
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="lg:hidden"
                                    onClick={() => setTasksOpen(true)}
                                >
                                    <ListTodo className="size-4" />
                                    {t('Tasks')}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="hidden lg:inline-flex"
                                    aria-pressed={!tasksCollapsed}
                                    onClick={() =>
                                        setTasksCollapsed(!tasksCollapsed)
                                    }
                                >
                                    <ListTodo className="size-4" />
                                    {tasksCollapsed
                                        ? t('Show tasks')
                                        : t('Hide tasks')}
                                </Button>
                            </>
                        }
                    />
                    <ConnectionBanner reconnecting={game.reconnecting} />
                    <div className="flex flex-1 lg:min-h-0">
                        {!tasksCollapsed && (
                            <aside className="hidden w-80 shrink-0 flex-col border-r lg:flex">
                                <TasksPane />
                            </aside>
                        )}
                        <Sheet open={tasksOpen} onOpenChange={setTasksOpen}>
                            <SheetContent
                                side="left"
                                className="w-full gap-0 sm:max-w-sm"
                            >
                                <SheetTitle className="sr-only">
                                    {t('Tasks')}
                                </SheetTitle>
                                <TasksPane
                                    onSelected={() => setTasksOpen(false)}
                                />
                            </SheetContent>
                        </Sheet>
                        <main
                            ref={setMainPane}
                            className="relative flex min-w-0 flex-1 flex-col gap-4 overflow-auto p-4"
                        >
                            <Table />
                        </main>
                    </div>
                </div>
            </div>
        </GameProvider>
    );
}

function Table() {
    const { snapshot } = useGame();
    const { t } = useTrans();
    const [adding, setAdding] = useState(false);
    const { game, me, current } = snapshot;
    const currentTask = current
        ? (snapshot.tasks.find((task) => task.id === current.taskId) ?? null)
        : null;

    if (snapshot.tasks.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <p className="text-muted-foreground">
                    {t('Add the first task')}
                </p>
                {me.canEditTasks && game.endedAt === null && (
                    <Button onClick={() => setAdding(true)}>
                        {t('Add task')}
                    </Button>
                )}
                <TaskFormDialog
                    task={null}
                    open={adding}
                    onOpenChange={setAdding}
                />
            </div>
        );
    }

    return (
        <>
            {current && currentTask ? (
                <>
                    <PlayersGrid />
                    <FacilitatorToolbar />
                    {current.round.revealedAt !== null && (
                        <ResultPanel round={current.round} />
                    )}
                    <TaskDetail task={currentTask} />
                </>
            ) : (
                <p className="flex flex-1 items-center justify-center text-center text-muted-foreground">
                    {me.isFacilitator
                        ? t('Pick a task to start voting')
                        : t('Waiting for the facilitator to pick a task')}
                </p>
            )}
            <Hand />
        </>
    );
}
```

Replace `resources/js/pages/poker/show.tsx` (the Task 5 placeholder) with:

```tsx
import { Head } from '@inertiajs/react';
import { Game } from '@/components/poker/game';
import type { PokerSnapshot } from '@/lib/poker/types';
import type { PokerDeckOption } from '@/types';

type Props = { snapshot: PokerSnapshot; deckOptions: PokerDeckOption[] };

export default function ShowPokerGame({ snapshot, deckOptions }: Props) {
    return (
        <>
            <Head title={snapshot.game.title} />
            <Game snapshot={snapshot} deckOptions={deckOptions} />
        </>
    );
}
```

- [ ] **Step 9: Translations**

Append to `lang/en.json` (key = value), `lang/fr.json`, `lang/es.json`, `lang/de.json`, only for keys still missing (`grep -c '^    "<key>":' lang/en.json` → 0). `Title`, `Description`, `Preview`, `Save`, `Cancel`, `Delete`, `Back to the team`, `Drag to reorder`, `Reordering cancelled.`, `Former member` already exist.

| Key | fr | es | de |
|---|---|---|---|
| `Tasks` | `Tâches` | `Tareas` | `Aufgaben` |
| `Add task` | `Ajouter une tâche` | `Añadir tarea` | `Aufgabe hinzufügen` |
| `Add the first task` | `Ajoutez la première tâche` | `Añade la primera tarea` | `Füge die erste Aufgabe hinzu` |
| `No tasks yet.` | `Aucune tâche pour l'instant.` | `Aún no hay tareas.` | `Noch keine Aufgaben.` |
| `Pick a task to start voting` | `Choisissez une tâche pour lancer le vote` | `Elige una tarea para empezar a votar` | `Wähle eine Aufgabe, um die Abstimmung zu starten` |
| `Waiting for the facilitator to pick a task` | `En attente du choix d'une tâche par l'animateur` | `Esperando a que el facilitador elija una tarea` | `Warte darauf, dass die Moderation eine Aufgabe wählt` |
| `Edit task` | `Modifier la tâche` | `Editar tarea` | `Aufgabe bearbeiten` |
| `Delete task` | `Supprimer la tâche` | `Eliminar tarea` | `Aufgabe löschen` |
| `Delete this task?` | `Supprimer cette tâche ?` | `¿Eliminar esta tarea?` | `Diese Aufgabe löschen?` |
| `Its rounds and votes are deleted too.` | `Ses tours et ses votes sont aussi supprimés.` | `Sus rondas y votos también se eliminan.` | `Ihre Runden und Stimmen werden ebenfalls gelöscht.` |
| `Write` | `Écrire` | `Escribir` | `Schreiben` |
| `Save to preview` | `Enregistrez pour afficher l'aperçu` | `Guarda para ver la vista previa` | `Speichere, um die Vorschau zu sehen` |
| `Markdown is supported.` | `Le Markdown est pris en charge.` | `Se admite Markdown.` | `Markdown wird unterstützt.` |
| `Rounds (:count)` | `Tours (:count)` | `Rondas (:count)` | `Runden (:count)` |
| `Round :number` | `Tour :number` | `Ronda :number` | `Runde :number` |
| `Not revealed · :count votes` | `Non révélé · :count votes` | `Sin revelar · :count votos` | `Nicht aufgedeckt · :count Stimmen` |
| `No rounds yet.` | `Aucun tour pour l'instant.` | `Aún no hay rondas.` | `Noch keine Runden.` |
| `Could not load the rounds.` | `Impossible de charger les tours.` | `No se pudieron cargar las rondas.` | `Die Runden konnten nicht geladen werden.` |
| `Take control` | `Prendre la main` | `Tomar el control` | `Moderation übernehmen` |
| `Game ended` | `Partie terminée` | `Partida terminada` | `Spiel beendet` |
| `Game title` | `Titre de la partie` | `Título de la partida` | `Spieltitel` |
| `This game was deleted.` | `Cette partie a été supprimée.` | `Esta partida se ha eliminado.` | `Dieses Spiel wurde gelöscht.` |
| `Your access to this game has ended.` | `Votre accès à cette partie a pris fin.` | `Tu acceso a esta partida ha terminado.` | `Dein Zugang zu diesem Spiel ist beendet.` |
| `Estimate: :value` | `Estimation : :value` | `Estimación: :value` | `Schätzung: :value` |
| `Show tasks` | `Afficher les tâches` | `Mostrar tareas` | `Aufgaben anzeigen` |
| `Hide tasks` | `Masquer les tâches` | `Ocultar tareas` | `Aufgaben ausblenden` |
| `Votes: :count` | `Votes : :count` | `Votos: :count` | `Stimmen: :count` |
| `Picked up :task.` | `:task saisie.` | `:task tomada.` | `:task aufgenommen.` |
| `Moved :task to position :position.` | `:task déplacée en position :position.` | `:task movida a la posición :position.` | `:task an Position :position verschoben.` |
| `Dropped :task.` | `:task déposée.` | `:task soltada.` | `:task abgelegt.` |
| `To pick up a task, press Space or Enter. Use the arrow keys to move it, Space or Enter to drop it, or Escape to cancel.` | `Pour saisir une tâche, appuyez sur Espace ou Entrée. Déplacez-la avec les flèches, déposez-la avec Espace ou Entrée, ou annulez avec Échap.` | `Para tomar una tarea, pulsa Espacio o Intro. Muévela con las flechas, suéltala con Espacio o Intro, o cancela con Escape.` | `Um eine Aufgabe aufzunehmen, drücke Leertaste oder Enter. Verschiebe sie mit den Pfeiltasten, lege sie mit Leertaste oder Enter ab oder brich mit Escape ab.` |
| `Average` | `Moyenne` | `Media` | `Durchschnitt` |
| `Most played: :cards` | `Le plus joué : :cards` | `Más jugada: :cards` | `Am häufigsten gespielt: :cards` |
| `No countable votes` | `Aucun vote comptabilisable` | `Ningún voto contable` | `Keine zählbaren Stimmen` |
| `Consensus` | `Consensus` | `Consenso` | `Konsens` |

- [ ] **Step 10: Type-check, lint and format**

Run: `npx vp check --fix resources/js/components/poker resources/js/pages/poker/show.tsx` then `npm run types:check && npm run check`.
Expected: no type errors; only the known pre-existing lint failures.

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php tests/Feature/Poker/PokerAccessTest.php`
Expected: PASS (the page component exists; every `t()` key is translated).

- [ ] **Step 11: Manual check**

With `composer run dev` (or `npm run dev` + Sail), open a game as its facilitator: the header shows the editable title, deck badge and presence; "Add task" creates a task that appears in a second browser without reload; dragging a task reorders it in both; clicking a task makes it current (highlighted, "Votes: 0"); the description renders Markdown; "Rounds (1)" lists "Round 1 · Not revealed · 0 votes"; below `lg` the tasks open in a drawer. Record the result in the ledger.

- [ ] **Step 12: Commit**

```bash
git add resources/js/components/poker resources/js/pages/poker/show.tsx lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat: add the planning poker game page with tasks and task details

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

### Task 15: The table (players grid, cards, hand, facilitator toolbar, result panel)

**Files:**
- Modify (replace Task 14 stubs): `resources/js/components/poker/{players-grid,hand,facilitator-toolbar,result-panel}.tsx`
- Create: `resources/js/components/poker/poker-card.tsx`
- Modify: `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: Task 13 (`useGame`, `nextUnestimatedTask`, `formatAverage`, `isSpecialCard`, types); Wayfinder `Poker/PokerVotesController` (`update`, `destroy`), `Poker/PokerRevealsController.store`, `Poker/PokerRoundsController.store`, `Poker/PokerTaskEstimatesController.update`, `Poker/PokerCurrentTasksController.update`.
- Produces:
  - `PokerCard({ value, face, selected, label, onClick, disabled })` — `button` (with `aria-pressed`) when `onClick` is given, else a `div` with `role="img"`.
  - `PlayersGrid()`, `Hand()`, `FacilitatorToolbar()`, `ResultPanel({ round }: { round: PokerRound })` with the behaviour below. Plan 10b adds the anonymous and "Watching" rows to `PlayersGrid`, the timer control to `FacilitatorToolbar` (after "Show votes") and the automatic-reveal note to `ResultPanel` (under the heading).

No JavaScript test runner exists; verification is types, lint and a two-browser manual check. The redaction guarantees are enforced and tested server-side (Tasks 4, 8, 12): these components only render what the snapshot carries.

- [ ] **Step 1: The card**

Create `resources/js/components/poker/poker-card.tsx`:

```tsx
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
    value: string | null;
    face: 'empty' | 'down' | 'up';
    selected?: boolean;
    label?: string;
    onClick?: () => void;
    disabled?: boolean;
};

export function PokerCard({
    value,
    face,
    selected = false,
    label,
    onClick,
    disabled = false,
}: Props) {
    const className = cn(
        'flex h-16 w-12 shrink-0 items-center justify-center rounded-lg border-2 text-lg font-semibold transition',
        face === 'empty' && 'border-dashed border-muted-foreground/40',
        face === 'down' && 'border-primary bg-primary text-primary-foreground',
        face === 'up' && 'border-foreground/20 bg-background shadow-sm',
        selected && '-translate-y-2 border-primary ring-2 ring-primary/40',
        onClick &&
            !disabled &&
            'cursor-pointer hover:-translate-y-1 hover:border-primary',
        disabled && 'opacity-50',
    );
    const content =
        face === 'down' ? (
            <Check className="size-5" aria-hidden="true" />
        ) : face === 'up' ? (
            value
        ) : null;

    if (onClick) {
        return (
            <button
                type="button"
                className={className}
                aria-pressed={selected}
                aria-label={label}
                disabled={disabled}
                onClick={onClick}
            >
                {content}
            </button>
        );
    }

    return (
        <div role="img" aria-label={label} className={className}>
            {content}
        </div>
    );
}
```

- [ ] **Step 2: The players grid**

Replace `resources/js/components/poker/players-grid.tsx` with:

```tsx
import { Crown } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { useGame } from './game-context';
import { PokerCard } from './poker-card';

/**
 * Seats at the table: online players plus anyone offline who already voted
 * in the current round, so a vote never disappears from the table.
 */
export function PlayersGrid() {
    const { snapshot, online } = useGame();
    const { t } = useTrans();
    const { game, current, players } = snapshot;

    if (!current) {
        return null;
    }

    const { round } = current;
    const onlineIds = new Set(online.map((member) => member.id));
    const votes = new Map(round.votes.map((vote) => [vote.playerId, vote]));
    const seated = players.filter(
        (player) =>
            !player.isSpectator &&
            (onlineIds.has(player.id) || votes.has(player.id)),
    );
    const isRevealed = round.revealedAt !== null;

    return (
        <section aria-label={t('Players')}>
            <ul className="flex flex-wrap justify-center gap-4">
                {seated.map((player) => {
                    const vote = votes.get(player.id);
                    const isOffline = !onlineIds.has(player.id);
                    const face = !vote
                        ? 'empty'
                        : isRevealed && vote.value !== null
                          ? 'up'
                          : 'down';
                    const status = vote ? t('Voted') : t('Not voted yet');

                    return (
                        <li
                            key={player.id}
                            className={cn(
                                'flex w-20 flex-col items-center gap-2 text-center',
                                isOffline && 'opacity-50',
                            )}
                        >
                            <PokerCard
                                value={face === 'up' ? (vote?.value ?? null) : null}
                                face={face}
                                label={`${player.name}: ${face === 'up' ? vote?.value : status}`}
                            />
                            <div className="flex max-w-full items-center gap-1">
                                <img
                                    src={player.avatarUrl}
                                    alt=""
                                    className="size-5 shrink-0 rounded-full bg-muted"
                                />
                                <span className="truncate text-xs">
                                    {player.name}
                                </span>
                                {game.facilitatorPlayerId === player.id && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Crown
                                                className="size-3 shrink-0 text-amber-500"
                                                aria-label={t('Facilitator')}
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            {t('Facilitator')}
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                            </div>
                            {isOffline && (
                                <span className="text-xs text-muted-foreground">
                                    {t('Offline')}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
```

- [ ] **Step 3: The hand**

Replace `resources/js/components/poker/hand.tsx` with:

```tsx
import { useState } from 'react';
import PokerVotesController from '@/actions/App/Http/Controllers/Poker/PokerVotesController';
import { useTrans } from '@/hooks/use-trans';
import type { PokerVoteResponse } from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';
import { PokerCard } from './poker-card';

export function Hand() {
    const { snapshot, apply, run, refetch } = useGame();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { game, me, current } = snapshot;
    const round = current?.round ?? null;

    if (!me.canVote) {
        return (
            <p className="sticky bottom-0 -mx-4 mt-auto border-t bg-background/95 px-4 py-3 text-center text-sm text-muted-foreground">
                {t("You're watching — switch to Play to vote")}
            </p>
        );
    }

    const isClosed =
        round === null || round.revealedAt !== null || game.endedAt !== null;

    const play = async (card: string) => {
        if (round === null) {
            return;
        }

        const withdraws = round.myVote === card;
        const route = { game: game.id, round: round.id };
        const countChange =
            withdraws ? -1 : round.myVote === null ? 1 : 0;

        setBusy(true);
        apply({
            type: 'vote.mine',
            response: {
                roundId: round.id,
                myVote: withdraws ? null : card,
                votesCount: round.votesCount + countChange,
                version: round.version,
                revealed: false,
            },
        });

        const response = await run(
            withdraws
                ? retroRequest<PokerVoteResponse>(
                      PokerVotesController.destroy(route),
                  )
                : retroRequest<PokerVoteResponse>(
                      PokerVotesController.update(route),
                      { value: card },
                  ),
        );

        setBusy(false);

        if (!response) {
            return;
        }

        apply({ type: 'vote.mine', response });

        if (response.revealed) {
            await refetch();
        }
    };

    return (
        <div
            role="group"
            aria-label={t('Your cards')}
            className="sticky bottom-0 -mx-4 mt-auto flex gap-2 overflow-x-auto border-t bg-background/95 px-4 pt-5 pb-3 backdrop-blur"
        >
            {game.cards.map((card) => (
                <PokerCard
                    key={card}
                    value={card}
                    face="up"
                    selected={round?.myVote === card}
                    label={t('Play :card', { card })}
                    disabled={isClosed || busy}
                    onClick={() => void play(card)}
                />
            ))}
        </div>
    );
}
```

The optimistic `vote.mine` raises the card at once; the server response (or the refetch that `run` does on a 422, e.g. when the round was revealed meanwhile) settles the real state.

- [ ] **Step 4: The result panel**

Replace `resources/js/components/poker/result-panel.tsx` with:

```tsx
import { usePage } from '@inertiajs/react';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import { formatAverage } from '@/lib/poker/format';
import type { PokerRound } from '@/lib/poker/types';
import { useGame } from './game-context';

export function ResultPanel({ round }: { round: PokerRound }) {
    const { snapshot } = useGame();
    const { t } = useTrans();
    const { locale } = usePage().props;
    const { result } = round;

    if (result === null) {
        return null;
    }

    const highest = Math.max(1, ...result.distribution.map((row) => row.count));
    const hasCountable = result.average !== null || result.mode.length > 0;

    return (
        <section
            aria-labelledby="poker-result"
            className="space-y-3 rounded-md border p-4"
        >
            <div className="flex flex-wrap items-center gap-3">
                <h2 id="poker-result" className="font-semibold">
                    {t('Result')}
                </h2>
                {result.consensus && <Badge>{t('Consensus')}</Badge>}
            </div>

            {!hasCountable ? (
                <p className="text-sm text-muted-foreground">
                    {t('No countable votes')}
                </p>
            ) : snapshot.game.isNumeric && result.average !== null ? (
                <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span>
                        {t('Average')}:{' '}
                        <span className="text-2xl font-semibold">
                            {formatAverage(result.average, locale)}
                        </span>
                    </span>
                    {result.nearestCard !== null && (
                        <span className="text-muted-foreground">
                            {t('Nearest card: :card', {
                                card: result.nearestCard,
                            })}
                        </span>
                    )}
                </p>
            ) : (
                <p>
                    {t('Most played: :cards', {
                        cards: result.mode.join(', '),
                    })}
                </p>
            )}

            <ul className="space-y-1">
                {result.distribution.map((row) => (
                    <li
                        key={row.value}
                        className="flex items-center gap-2 text-sm"
                    >
                        <span className="w-10 text-right font-mono font-semibold">
                            {row.value}
                        </span>
                        <span
                            className="h-3 rounded bg-primary"
                            style={{ width: `${(row.count / highest) * 70}%` }}
                            aria-hidden="true"
                        />
                        <span className="text-muted-foreground">
                            {row.count}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
```

- [ ] **Step 5: The facilitator toolbar**

Replace `resources/js/components/poker/facilitator-toolbar.tsx` with:

```tsx
import { useState } from 'react';
import PokerCurrentTasksController from '@/actions/App/Http/Controllers/Poker/PokerCurrentTasksController';
import PokerRevealsController from '@/actions/App/Http/Controllers/Poker/PokerRevealsController';
import PokerRoundsController from '@/actions/App/Http/Controllers/Poker/PokerRoundsController';
import PokerTaskEstimatesController from '@/actions/App/Http/Controllers/Poker/PokerTaskEstimatesController';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import { nextUnestimatedTask } from '@/lib/poker/game-reducer';
import {
    isSpecialCard,
    type PokerResult,
    type PokerTask,
} from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';

/** Spec Decision 2: nearest card for numeric decks, the single mode otherwise. */
function suggestedEstimate(
    result: PokerResult | null,
    isNumeric: boolean,
): string | null {
    if (!result) {
        return null;
    }

    if (isNumeric) {
        return result.nearestCard;
    }

    return result.mode.length === 1 ? result.mode[0] : null;
}

export function FacilitatorToolbar() {
    const { snapshot, apply, run, refetch } = useGame();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const [choice, setChoice] = useState<{
        roundId: string;
        value: string;
    } | null>(null);
    const { game, me, current } = snapshot;

    if (!me.isFacilitator || !current || game.endedAt !== null) {
        return null;
    }

    const { round, taskId } = current;
    const task = snapshot.tasks.find((candidate) => candidate.id === taskId);
    const isRevealed = round.revealedAt !== null;
    const estimateCards = game.cards.filter((card) => !isSpecialCard(card));
    const estimate =
        choice?.roundId === round.id
            ? choice.value
            : (task?.estimate ??
              suggestedEstimate(round.result, game.isNumeric) ??
              '');
    const next = nextUnestimatedTask(snapshot);

    const perform = async <T,>(mutation: Promise<T>): Promise<T | undefined> => {
        setBusy(true);

        const result = await run(mutation);

        setBusy(false);

        return result;
    };

    const reveal = async () => {
        const result = await perform(
            retroRequest(
                PokerRevealsController.store({ game: game.id, round: round.id }),
            ),
        );

        if (result !== undefined) {
            await refetch();
        }
    };

    const revote = async () => {
        const result = await perform(
            retroRequest(
                PokerRoundsController.store({ game: game.id, task: taskId }),
            ),
        );

        if (result !== undefined) {
            await refetch();
        }
    };

    const saveEstimate = async () => {
        const saved = await perform(
            retroRequest<PokerTask>(
                PokerTaskEstimatesController.update({
                    game: game.id,
                    task: taskId,
                }),
                { value: estimate },
            ),
        );

        if (saved) {
            apply({ type: 'task.upsert', task: saved });
        }
    };

    const goToNext = async () => {
        if (!next) {
            return;
        }

        const result = await perform(
            retroRequest(PokerCurrentTasksController.update(game.id), {
                task_id: next.id,
            }),
        );

        if (result !== undefined) {
            await refetch();
        }
    };

    return (
        <div
            role="toolbar"
            aria-label={t('Facilitator tools')}
            className="flex flex-wrap items-center justify-center gap-2"
        >
            {!isRevealed ? (
                <Button
                    disabled={busy || round.votesCount === 0}
                    onClick={() => void reveal()}
                >
                    {t('Show votes')}
                </Button>
            ) : (
                <>
                    <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => void revote()}
                    >
                        {t('Re-vote')}
                    </Button>
                    <Select
                        value={estimate}
                        onValueChange={(value) =>
                            setChoice({ roundId: round.id, value })
                        }
                    >
                        <SelectTrigger
                            className="w-28"
                            aria-label={t('Estimate')}
                        >
                            <SelectValue placeholder={t('Estimate')} />
                        </SelectTrigger>
                        <SelectContent>
                            {estimateCards.map((card) => (
                                <SelectItem key={card} value={card}>
                                    {card}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        disabled={busy || estimate === ''}
                        onClick={() => void saveEstimate()}
                    >
                        {t('Save estimate')}
                    </Button>
                </>
            )}
            <Button
                variant="ghost"
                disabled={busy || next === null}
                onClick={() => void goToNext()}
            >
                {t('Next task')}
            </Button>
        </div>
    );
}
```

The select is controlled: a card the facilitator picks for this round wins; otherwise it shows the task's saved estimate, else the suggestion (spec §3 step 6 "The UI preselects…"). Clearing an estimate (`value: null`) is not offered in the toolbar in this plan; the endpoint supports it for MCP and later UI.

- [ ] **Step 6: Translations**

Append for keys still missing (`Average`, `Most played: :cards`, `No countable votes`, `Consensus` and `Votes: :count` were added by Task 14; skip any key already present):

| Key | fr | es | de |
|---|---|---|---|
| `Show votes` | `Révéler les votes` | `Mostrar votos` | `Stimmen aufdecken` |
| `Re-vote` | `Revoter` | `Volver a votar` | `Neu abstimmen` |
| `Save estimate` | `Enregistrer l'estimation` | `Guardar estimación` | `Schätzung speichern` |
| `Next task` | `Tâche suivante` | `Siguiente tarea` | `Nächste Aufgabe` |
| `Estimate` | `Estimation` | `Estimación` | `Schätzung` |
| `Nearest card: :card` | `Carte la plus proche : :card` | `Carta más cercana: :card` | `Nächste Karte: :card` |
| `Facilitator` | `Animateur` | `Facilitador` | `Moderation` |
| `Offline` | `Hors ligne` | `Sin conexión` | `Offline` |
| `Play :card` | `Jouer :card` | `Jugar :card` | `:card spielen` |
| `You're watching — switch to Play to vote` | `Vous observez — passez en mode Jouer pour voter` | `Estás observando: cambia a Jugar para votar` | `Du schaust zu – wechsle zu Spielen, um abzustimmen` |
| `Voted` | `A voté` | `Ha votado` | `Hat abgestimmt` |
| `Not voted yet` | `Pas encore voté` | `Aún no ha votado` | `Noch nicht abgestimmt` |
| `Your cards` | `Vos cartes` | `Tus cartas` | `Deine Karten` |
| `Facilitator tools` | `Outils de l'animateur` | `Herramientas del facilitador` | `Moderationswerkzeuge` |
| `Result` | `Résultat` | `Resultado` | `Ergebnis` |
| `Players` | `Joueurs` | `Jugadores` | `Spielende` |

- [ ] **Step 7: Type-check, lint and format**

Run: `npx vp check --fix resources/js/components/poker` then `npm run types:check && npm run check`.
Expected: no type errors; only the known pre-existing lint failures.

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 8: Manual check (two browsers)**

Facilitator (browser A) and a member (browser B) in one game with a current task: B plays `5` → A sees B's card face-down at once and never a value; B clicks `5` again → the card empties in A; both vote, A clicks "Show votes" → both see the values, the average with one decimal in the UI locale, the nearest card preselected in A's estimate select and the distribution bars; "Save estimate" shows the estimate chip in both task lists; "Re-vote" empties the table and "Rounds (2)" lists round 1 with its values; "Next task" selects the next unestimated task. On a T-shirt game the panel shows "Most played" instead of an average. Record the result in the ledger.

- [ ] **Step 9: Commit**

```bash
git add resources/js/components/poker/poker-card.tsx resources/js/components/poker/players-grid.tsx resources/js/components/poker/hand.tsx resources/js/components/poker/facilitator-toolbar.tsx resources/js/components/poker/result-panel.tsx lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat: add the poker table, hand, reveal and estimate controls

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

#### Implementer notes

- The app has no Tailwind typography plugin (`prose` is unavailable, and adding `@tailwindcss/typography` would be a new dependency), so Task 14 styles server-rendered Markdown with the exported `MarkdownClasses` descendant selectors instead of `prose prose-sm dark:prose-invert`.
- `Average`, `Most played: :cards`, `No countable votes`, `Consensus` and `Votes: :count` are first used by Task 14 (round history, task list), so Task 14 owns their translation rows; Task 15 lists only the rest.
- Task 14's `Game` declares `const [, setMainPane]` so the unused element doesn't trip the linter; Plan 10b Task 7 renames it to `[mainPane, setMainPane]`.

### Task 16: Facilitator menu and dialogs, join page polish

**Files:**
- Modify (replace Task 14 stub): `resources/js/components/poker/game-menu.tsx`
- Create: `resources/js/components/poker/{game-settings-dialog,deck-fields,game-guest-link-dialog,transfer-dialog,delete-game-dialog}.tsx`
- Modify: `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: Task 13 (`useGame()` → `GameContextValue` with `snapshot`, `run`, `refetch`, `handleError`, `sessionExpired`, `deckOptions`; `PokerDeckOption` from `@/types`; `SpecialCards` from `@/lib/poker/types`); Wayfinder `PokerSettingsController`, `PokerStatusesController`, `PokerGuestTokensController`, `PokerFacilitatorsController`, `PokerGamesController` (routes of Tasks 5 and 10).
- Produces:
  - `GameMenu()` — renders nothing unless `me.isFacilitator || me.canDelete`; dropdown (lucide `Settings2`, `aria-label={t('Facilitator menu')}`): for the facilitator "Settings…", "Guest link…", "Hand over facilitation…", "End game" / "Reopen game"; separator; "Delete game…" when `me.canDelete`. A workspace admin who is not the facilitator sees only "Delete game…". The component guards itself, so the header renders `<GameMenu />` unconditionally (see "Outline issues").
  - `DeckChoice = { deck: string; customCards: string; includeUnknown: boolean; includeCoffee: boolean }`, `emptyDeckChoice(): DeckChoice`, `deckChoiceFromGame(game: { deck: string; cards: string[] }): DeckChoice`, `deckPayload(choice: DeckChoice): Record<string, unknown>`, `DeckFields({ deckOptions, value, onChange, disabled, errors })`. Plan 10b adds saved decks to `DeckFields`.
  - `GameSettingsDialog({ open, onOpenChange })` — title, `DeckFields` (disabled with "The deck can't change once votes exist." when `snapshot.game.hasVotes`), "Allow guests"; PATCH settings with changed keys only, then `refetch()`; inline error from the 422. Plan 10b adds four switches.
  - `GameGuestLinkDialog({ open, onOpenChange })`, `TransferDialog({ open, onOpenChange })`, `DeleteGameDialog({ open, onOpenChange })`.

- [ ] **Step 1: Deck fields**

Create `resources/js/components/poker/deck-fields.tsx`:

```tsx
import InputError from '@/components/input-error';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import { isSpecialCard, SpecialCards } from '@/lib/poker/types';
import { cn } from '@/lib/utils';
import type { PokerDeckOption } from '@/types';

export type DeckChoice = {
    deck: string;
    customCards: string;
    includeUnknown: boolean;
    includeCoffee: boolean;
};

const [UnknownCard, CoffeeCard] = SpecialCards;

export function emptyDeckChoice(): DeckChoice {
    return {
        deck: 'fibonacci',
        customCards: '',
        includeUnknown: true,
        includeCoffee: true,
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
        deck: 'custom',
        customCards: game.cards
            .filter((card) => !isSpecialCard(card))
            .join(', '),
        includeUnknown: game.cards.includes(UnknownCard),
        includeCoffee: game.cards.includes(CoffeeCard),
    };
}

export function splitCustomCards(value: string): string[] {
    return value
        .split(',')
        .map((card) => card.trim())
        .filter((card) => card !== '');
}

export function deckPayload(choice: DeckChoice): Record<string, unknown> {
    if (choice.deck !== 'custom') {
        return { deck: choice.deck };
    }

    return {
        deck: 'custom',
        custom_cards: splitCustomCards(choice.customCards),
        include_unknown: choice.includeUnknown,
        include_coffee: choice.includeCoffee,
    };
}

type Props = {
    deckOptions: PokerDeckOption[];
    value: DeckChoice;
    onChange: (value: DeckChoice) => void;
    disabled?: boolean;
    errors?: Record<string, string | undefined>;
};

function customCardsError(
    errors: Record<string, string | undefined>,
): string | undefined {
    if (errors.custom_cards) {
        return errors.custom_cards;
    }

    const itemKey = Object.keys(errors).find((key) =>
        key.startsWith('custom_cards.'),
    );

    return itemKey ? errors[itemKey] : undefined;
}

export function DeckFields({
    deckOptions,
    value,
    onChange,
    disabled = false,
    errors = {},
}: Props) {
    const { t } = useTrans();
    const update = (changes: Partial<DeckChoice>) =>
        onChange({ ...value, ...changes });

    return (
        <fieldset className="space-y-2" disabled={disabled}>
            <legend className="text-sm font-medium">{t('Deck')}</legend>
            <div
                role="radiogroup"
                aria-label={t('Deck')}
                className="grid gap-1"
            >
                {deckOptions.map((option) => {
                    const checked = value.deck === option.value;

                    return (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            disabled={disabled}
                            className={cn(
                                'rounded-md border p-2 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60',
                                checked && 'border-primary bg-muted',
                            )}
                            onClick={() => update({ deck: option.value })}
                        >
                            <span className="block text-sm font-medium">
                                {option.label}
                            </span>
                            {option.cards.length > 0 && (
                                <span className="mt-1 flex flex-wrap gap-1">
                                    {option.cards.map((card) => (
                                        <span
                                            key={card}
                                            className="min-w-6 rounded border bg-background px-1 text-center font-mono text-xs"
                                        >
                                            {card}
                                        </span>
                                    ))}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
            <InputError message={errors.deck} />

            {value.deck === 'custom' && (
                <div className="space-y-2 rounded-md border p-3">
                    <div className="grid gap-2">
                        <Label htmlFor="deck-custom-cards">
                            {t('Custom cards')}
                        </Label>
                        <Input
                            id="deck-custom-cards"
                            value={value.customCards}
                            placeholder="1, 2, 3, 5, 8"
                            onChange={(event) =>
                                update({ customCards: event.target.value })
                            }
                        />
                        <p className="text-xs text-muted-foreground">
                            {t('Separate cards with commas.')}
                        </p>
                        <InputError message={customCardsError(errors)} />
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="deck-include-unknown"
                                checked={value.includeUnknown}
                                onCheckedChange={(checked) =>
                                    update({ includeUnknown: checked === true })
                                }
                            />
                            <Label htmlFor="deck-include-unknown">
                                {t('Add :card', { card: UnknownCard })}
                            </Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="deck-include-coffee"
                                checked={value.includeCoffee}
                                onCheckedChange={(checked) =>
                                    update({ includeCoffee: checked === true })
                                }
                            />
                            <Label htmlFor="deck-include-coffee">
                                {t('Add :card', { card: CoffeeCard })}
                            </Label>
                        </div>
                    </div>
                </div>
            )}
        </fieldset>
    );
}
```

- [ ] **Step 2: Settings dialog**

Create `resources/js/components/poker/game-settings-dialog.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import PokerSettingsController from '@/actions/App/Http/Controllers/Poker/PokerSettingsController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import {
    deckChoiceFromGame,
    DeckFields,
    deckPayload,
    type DeckChoice,
} from './deck-fields';
import { useGame } from './game-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function GameSettingsDialog({ open, onOpenChange }: Props) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                aria-describedby={undefined}
                className="max-h-[90dvh] overflow-y-auto"
            >
                {open && <SettingsForm onDone={() => onOpenChange(false)} />}
            </DialogContent>
        </Dialog>
    );
}

function firstErrors(
    errors: Record<string, string[]>,
): Record<string, string | undefined> {
    return Object.fromEntries(
        Object.entries(errors).map(([key, messages]) => [key, messages[0]]),
    );
}

function SettingsForm({ onDone }: { onDone: () => void }) {
    const ctx = useGame();
    const { t } = useTrans();
    const { game } = ctx.snapshot;
    const initialDeck = deckChoiceFromGame(game);
    const [title, setTitle] = useState(game.title);
    const [deck, setDeck] = useState<DeckChoice>(initialDeck);
    const [guestAccessEnabled, setGuestAccessEnabled] = useState(
        game.guestAccessEnabled,
    );
    const [errors, setErrors] = useState<Record<string, string | undefined>>(
        {},
    );
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const deckLocked = game.hasVotes;

    const save = async (event: FormEvent) => {
        event.preventDefault();

        const changes: Record<string, unknown> = {};

        if (title !== game.title) {
            changes.title = title;
        }

        const deckChanges = deckPayload(deck);

        if (
            !deckLocked &&
            JSON.stringify(deckChanges) !==
                JSON.stringify(deckPayload(initialDeck))
        ) {
            Object.assign(changes, deckChanges);
        }

        if (guestAccessEnabled !== game.guestAccessEnabled) {
            changes.guest_access_enabled = guestAccessEnabled;
        }

        if (Object.keys(changes).length === 0) {
            onDone();

            return;
        }

        setSaving(true);
        setError(null);
        setErrors({});

        try {
            await retroRequest(PokerSettingsController.update(game.id), changes);
            await ctx.refetch();
            onDone();
        } catch (caught) {
            const message = ctx.handleError(caught);

            if (message === null) {
                onDone();

                return;
            }

            if (caught instanceof RetroRequestError) {
                setErrors(firstErrors(caught.errors));
            }

            setError(message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={(event) => void save(event)} className="space-y-4">
            <DialogTitle>{t('Game settings')}</DialogTitle>

            <div className="grid gap-2">
                <Label htmlFor="poker-title">{t('Title')}</Label>
                <Input
                    id="poker-title"
                    value={title}
                    maxLength={120}
                    required
                    onChange={(event) => setTitle(event.target.value)}
                />
                <InputError message={errors.title} />
            </div>

            <div className="space-y-2">
                <DeckFields
                    deckOptions={ctx.deckOptions}
                    value={deck}
                    onChange={setDeck}
                    disabled={deckLocked}
                    errors={errors}
                />
                {deckLocked && (
                    <p className="text-xs text-muted-foreground">
                        {t("The deck can't change once votes exist.")}
                    </p>
                )}
            </div>

            <div className="flex items-center gap-2">
                <Checkbox
                    id="poker-guest-access"
                    checked={guestAccessEnabled}
                    onCheckedChange={(checked) =>
                        setGuestAccessEnabled(checked === true)
                    }
                />
                <Label htmlFor="poker-guest-access">{t('Allow guests')}</Label>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter className="gap-2">
                <Button type="button" variant="secondary" onClick={onDone}>
                    {t('Cancel')}
                </Button>
                <Button disabled={saving}>{t('Save')}</Button>
            </DialogFooter>
        </form>
    );
}
```

- [ ] **Step 3: Guest link dialog**

Create `resources/js/components/poker/game-guest-link-dialog.tsx` (same UI and strings as `retro/guest-link-dialog.tsx`):

```tsx
import { useState } from 'react';
import { toast } from 'sonner';
import PokerGuestTokensController from '@/actions/App/Http/Controllers/Poker/PokerGuestTokensController';
import PokerSettingsController from '@/actions/App/Http/Controllers/Poker/PokerSettingsController';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function GameGuestLinkDialog({ open, onOpenChange }: Props) {
    const ctx = useGame();
    const { t } = useTrans();
    const { game } = ctx.snapshot;
    const [busy, setBusy] = useState(false);

    const toggle = async (enabled: boolean) => {
        setBusy(true);

        const result = await ctx.run(
            retroRequest(PokerSettingsController.update(game.id), {
                guest_access_enabled: enabled,
            }),
        );

        if (result !== undefined) {
            await ctx.refetch();
        }

        setBusy(false);
    };

    const regenerate = async () => {
        setBusy(true);

        const result = await ctx.run(
            retroRequest<{ guestUrl: string }>(
                PokerGuestTokensController.store(game.id),
            ),
        );

        if (result) {
            await ctx.refetch();
        }

        setBusy(false);
    };

    const copy = async () => {
        if (!game.guestUrl) {
            return;
        }

        try {
            await navigator.clipboard.writeText(game.guestUrl);
            toast(t('Link copied'));
        } catch {
            toast.error(t('Something went wrong. Please try again.'));
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined}>
                <DialogTitle>{t('Guest link')}</DialogTitle>

                <div className="flex items-center gap-2">
                    <Checkbox
                        id="poker-guest-link-access"
                        checked={game.guestAccessEnabled}
                        disabled={busy}
                        onCheckedChange={(checked) =>
                            void toggle(checked === true)
                        }
                    />
                    <Label htmlFor="poker-guest-link-access">
                        {t('Allow guests')}
                    </Label>
                </div>

                {game.guestAccessEnabled && game.guestUrl && (
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <Input
                                readOnly
                                value={game.guestUrl}
                                aria-label={t('Guest link')}
                                onFocus={(event) => event.target.select()}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => void copy()}
                            >
                                {t('Copy')}
                            </Button>
                        </div>
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void regenerate()}
                        >
                            {t('Create a new link')}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                            {t(
                                'Creating a new link signs out every guest who joined with the old one.',
                            )}
                        </p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 4: Transfer dialog**

Create `resources/js/components/poker/transfer-dialog.tsx` (same UI as `retro/handover-dialog.tsx`):

```tsx
import { useState } from 'react';
import PokerFacilitatorsController from '@/actions/App/Http/Controllers/Poker/PokerFacilitatorsController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function TransferDialog({ open, onOpenChange }: Props) {
    const ctx = useGame();
    const { t } = useTrans();
    const [userId, setUserId] = useState('');
    const [busy, setBusy] = useState(false);
    const candidates = ctx.snapshot.me.transferCandidates;

    const handOver = async () => {
        setBusy(true);

        const result = await ctx.run(
            retroRequest(
                PokerFacilitatorsController.update(ctx.snapshot.game.id),
                { user_id: userId },
            ),
        );

        setBusy(false);

        if (result !== undefined) {
            await ctx.refetch();
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined}>
                <DialogTitle>{t('Hand over facilitation')}</DialogTitle>

                {candidates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {t('No one else can facilitate this game yet.')}
                    </p>
                ) : (
                    <div className="grid gap-2">
                        <Label htmlFor="poker-new-facilitator">
                            {t('New facilitator')}
                        </Label>
                        <Select value={userId} onValueChange={setUserId}>
                            <SelectTrigger id="poker-new-facilitator">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {candidates.map((candidate) => (
                                    <SelectItem
                                        key={candidate.userId}
                                        value={candidate.userId}
                                    >
                                        {candidate.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => onOpenChange(false)}
                    >
                        {t('Cancel')}
                    </Button>
                    {candidates.length > 0 && (
                        <Button
                            disabled={busy || userId === ''}
                            onClick={() => void handOver()}
                        >
                            {t('Hand over')}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
```

`result !== undefined` works because `retroRequest` resolves `null` for the 204 answer and `ctx.run` resolves `undefined` only on failure.

- [ ] **Step 5: Delete dialog**

Create `resources/js/components/poker/delete-game-dialog.tsx`:

```tsx
import { router } from '@inertiajs/react';
import { useState } from 'react';
import PokerGamesController from '@/actions/App/Http/Controllers/Poker/PokerGamesController';
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
import { useGame } from './game-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function DeleteGameDialog({ open, onOpenChange }: Props) {
    const ctx = useGame();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);

    const destroy = async () => {
        setBusy(true);

        const result = await ctx.run(
            retroRequest(PokerGamesController.destroy(ctx.snapshot.game.id)),
        );

        setBusy(false);

        if (result !== undefined) {
            router.visit(ctx.snapshot.links.team ?? dashboard().url);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogTitle>{t('Delete this game?')}</DialogTitle>
                <DialogDescription>
                    {t('Its tasks, rounds and votes are deleted for everyone.')}
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

- [ ] **Step 6: Game menu (replaces the Task 14 stub)**

Replace `resources/js/components/poker/game-menu.tsx` entirely:

```tsx
import { Settings2 } from 'lucide-react';
import { useState } from 'react';
import PokerStatusesController from '@/actions/App/Http/Controllers/Poker/PokerStatusesController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { DeleteGameDialog } from './delete-game-dialog';
import { useGame } from './game-context';
import { GameGuestLinkDialog } from './game-guest-link-dialog';
import { GameSettingsDialog } from './game-settings-dialog';
import { TransferDialog } from './transfer-dialog';

type OpenDialog = 'settings' | 'guests' | 'transfer' | 'end' | 'delete' | null;

export function GameMenu() {
    const ctx = useGame();
    const { t } = useTrans();
    const [chosen, setChosen] = useState<OpenDialog>(null);
    const [busy, setBusy] = useState(false);
    const { game, me } = ctx.snapshot;
    const open = ctx.sessionExpired ? null : chosen;
    const isEnded = game.endedAt !== null;

    if (!me.isFacilitator && !me.canDelete) {
        return null;
    }

    const close = (isOpen: boolean) => {
        if (!isOpen) {
            setChosen(null);
        }
    };

    const setEnded = async (ended: boolean) => {
        setBusy(true);

        const result = await ctx.run(
            retroRequest(PokerStatusesController.update(game.id), { ended }),
        );

        setBusy(false);

        if (result !== undefined) {
            setChosen(null);
            await ctx.refetch();
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        size="sm"
                        variant="outline"
                        aria-label={t('Facilitator menu')}
                    >
                        <Settings2 className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {me.isFacilitator && (
                        <>
                            {!isEnded && (
                                <>
                                    <DropdownMenuItem
                                        onSelect={() => setChosen('settings')}
                                    >
                                        {t('Settings…')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onSelect={() => setChosen('guests')}
                                    >
                                        {t('Guest link…')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onSelect={() => setChosen('transfer')}
                                    >
                                        {t('Hand over facilitation…')}
                                    </DropdownMenuItem>
                                </>
                            )}
                            {isEnded ? (
                                <DropdownMenuItem
                                    disabled={busy}
                                    onSelect={() => void setEnded(false)}
                                >
                                    {t('Reopen game')}
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem
                                    onSelect={() => setChosen('end')}
                                >
                                    {t('End game')}
                                </DropdownMenuItem>
                            )}
                        </>
                    )}
                    {me.canDelete && (
                        <>
                            {me.isFacilitator && <DropdownMenuSeparator />}
                            <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setChosen('delete')}
                            >
                                {t('Delete game…')}
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
            <GameSettingsDialog open={open === 'settings'} onOpenChange={close} />
            <GameGuestLinkDialog open={open === 'guests'} onOpenChange={close} />
            <TransferDialog open={open === 'transfer'} onOpenChange={close} />
            <DeleteGameDialog open={open === 'delete'} onOpenChange={close} />
            <Dialog open={open === 'end'} onOpenChange={close}>
                <DialogContent>
                    <DialogTitle>{t('End this game?')}</DialogTitle>
                    <DialogDescription>
                        {t('It becomes read-only until reopened.')}
                    </DialogDescription>
                    <DialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setChosen(null)}
                        >
                            {t('Cancel')}
                        </Button>
                        <Button
                            disabled={busy}
                            onClick={() => void setEnded(true)}
                        >
                            {t('End game')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
```

Settings, guest link and hand-over are hidden on an ended game because every one of those mutations answers 403 "This game has ended." (Task 10); only "Reopen game" and "Delete game…" remain.

- [ ] **Step 7: Translations**

Append to each file (skip any key already present at execution time; `Settings…`, `Guest link…`, `Hand over facilitation…`, `Allow guests`, `Facilitator menu`, `Cancel`, `Save`, `Delete`, `Title`, `Hand over facilitation`, `Hand over`, `New facilitator`, `Guest link`, `Copy`, `Link copied`, `Create a new link`, `Creating a new link signs out every guest who joined with the old one.` already exist; `The deck can't change once votes exist.` comes from Task 10):

`lang/en.json`:
```json
    "End game": "End game",
    "Reopen game": "Reopen game",
    "End this game?": "End this game?",
    "It becomes read-only until reopened.": "It becomes read-only until reopened.",
    "Delete game…": "Delete game…",
    "Delete this game?": "Delete this game?",
    "Its tasks, rounds and votes are deleted for everyone.": "Its tasks, rounds and votes are deleted for everyone.",
    "Game settings": "Game settings",
    "Deck": "Deck",
    "Custom cards": "Custom cards",
    "Separate cards with commas.": "Separate cards with commas.",
    "Add :card": "Add :card",
    "No one else can facilitate this game yet.": "No one else can facilitate this game yet."
```

`lang/fr.json`:
```json
    "End game": "Terminer la partie",
    "Reopen game": "Rouvrir la partie",
    "End this game?": "Terminer cette partie ?",
    "It becomes read-only until reopened.": "Elle passe en lecture seule jusqu'à sa réouverture.",
    "Delete game…": "Supprimer la partie…",
    "Delete this game?": "Supprimer cette partie ?",
    "Its tasks, rounds and votes are deleted for everyone.": "Ses tâches, tours et votes sont supprimés pour tout le monde.",
    "Game settings": "Paramètres de la partie",
    "Deck": "Jeu de cartes",
    "Custom cards": "Cartes personnalisées",
    "Separate cards with commas.": "Séparez les cartes par des virgules.",
    "Add :card": "Ajouter :card",
    "No one else can facilitate this game yet.": "Personne d'autre ne peut encore animer cette partie."
```

`lang/es.json`:
```json
    "End game": "Terminar la partida",
    "Reopen game": "Reabrir la partida",
    "End this game?": "¿Terminar esta partida?",
    "It becomes read-only until reopened.": "Queda en solo lectura hasta que se reabra.",
    "Delete game…": "Eliminar la partida…",
    "Delete this game?": "¿Eliminar esta partida?",
    "Its tasks, rounds and votes are deleted for everyone.": "Sus tareas, rondas y votos se eliminan para todos.",
    "Game settings": "Ajustes de la partida",
    "Deck": "Baraja",
    "Custom cards": "Cartas personalizadas",
    "Separate cards with commas.": "Separa las cartas con comas.",
    "Add :card": "Añadir :card",
    "No one else can facilitate this game yet.": "Nadie más puede facilitar esta partida todavía."
```

`lang/de.json`:
```json
    "End game": "Spiel beenden",
    "Reopen game": "Spiel wieder öffnen",
    "End this game?": "Dieses Spiel beenden?",
    "It becomes read-only until reopened.": "Es ist schreibgeschützt, bis es wieder geöffnet wird.",
    "Delete game…": "Spiel löschen…",
    "Delete this game?": "Dieses Spiel löschen?",
    "Its tasks, rounds and votes are deleted for everyone.": "Seine Aufgaben, Runden und Stimmen werden für alle gelöscht.",
    "Game settings": "Spieleinstellungen",
    "Deck": "Kartensatz",
    "Custom cards": "Eigene Karten",
    "Separate cards with commas.": "Trenne die Karten mit Kommas.",
    "Add :card": ":card hinzufügen",
    "No one else can facilitate this game yet.": "Noch niemand sonst kann dieses Spiel moderieren."
```

(Each block is appended before the closing `}` of its file, adding a comma after the previous last entry.)

- [ ] **Step 8: Checks**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check`
Expected: no new errors (only the known pre-existing failures in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`).

Run: `npx vp check --fix resources/js/components/poker/game-menu.tsx resources/js/components/poker/game-settings-dialog.tsx resources/js/components/poker/deck-fields.tsx resources/js/components/poker/game-guest-link-dialog.tsx resources/js/components/poker/transfer-dialog.tsx resources/js/components/poker/delete-game-dialog.tsx`

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add resources/js/components/poker/game-menu.tsx resources/js/components/poker/game-settings-dialog.tsx resources/js/components/poker/deck-fields.tsx resources/js/components/poker/game-guest-link-dialog.tsx resources/js/components/poker/transfer-dialog.tsx resources/js/components/poker/delete-game-dialog.tsx lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat: add the poker facilitator menu, settings, guest link, hand-over and delete dialogs

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

#### Implementer notes

- `isSpecialCard`/`SpecialCards` are imported from `@/lib/poker/types` (Task 13 declares both; the file must export them as values, so it is a `.ts` module with runtime code, not type-only).

### Task 17: Team page section, new game dialog and estimation history page

**Files:**
- Create: `resources/js/components/teams/poker-games-section.tsx`, `resources/js/components/teams/new-poker-game-dialog.tsx`
- Modify: `resources/js/pages/teams/show.tsx` (new props, section under Retrospectives), `resources/js/pages/poker/estimates.tsx` (final, replaces the Task 11 placeholder), `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: `DeckFields`, `deckPayload`, `emptyDeckChoice`, `DeckChoice` (Task 16, `@/components/poker/deck-fields`); `PokerGameSummary`, `PokerDeckOption`, `EstimatedTaskRow` (`@/types`, Task 13); `PokerRound` (`@/lib/poker/types`); `formatAverage` (`@/lib/poker/format`); Wayfinder `TeamPokerGamesController` (`store`), `TeamEstimatesController` (`index`), `Poker/PokerGamesController` (`show`), `TeamsController` (`show`); props of Task 6 (`pokerGames`, `pokerDeckOptions`, `canCreatePokerGame`) and Task 11 (`workspace`, `team`, `games`, `filters`, `tasks`, `pagination`).
- Produces:
  - `PokerGamesSection({ workspaceSlug, teamId, games, deckOptions, canCreate })`.
  - `NewPokerGameDialog({ workspaceSlug, teamId, deckOptions })` — `useForm` with `title`, `anonymous_votes`, `auto_reveal`, deck state in a `DeckChoice`; submit merges `deckPayload(deck)` via `form.transform`. Plan 10b adds saved decks and "Save this deck for the team as…".
  - `pages/poker/estimates.tsx` (default export `PokerEstimates`).

- [ ] **Step 1: New game dialog**

Create `resources/js/components/teams/new-poker-game-dialog.tsx`:

```tsx
import { useForm, usePage } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import TeamPokerGamesController from '@/actions/App/Http/Controllers/TeamPokerGamesController';
import InputError from '@/components/input-error';
import {
    DeckFields,
    deckPayload,
    emptyDeckChoice,
    type DeckChoice,
} from '@/components/poker/deck-fields';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import type { PokerDeckOption } from '@/types';

type Props = {
    workspaceSlug: string;
    teamId: string;
    deckOptions: PokerDeckOption[];
};

type PokerGameForm = {
    title: string;
    anonymous_votes: boolean;
    auto_reveal: boolean;
};

export function NewPokerGameDialog(props: Props) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>{t('New game')}</Button>
            </DialogTrigger>
            <DialogContent
                aria-describedby={undefined}
                className="max-h-[90dvh] overflow-y-auto"
            >
                {open && (
                    <NewPokerGameForm
                        {...props}
                        onDone={() => setOpen(false)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function NewPokerGameForm({
    workspaceSlug,
    teamId,
    deckOptions,
    onDone,
}: Props & { onDone: () => void }) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [deck, setDeck] = useState<DeckChoice>(emptyDeckChoice);
    const form = useForm<PokerGameForm>({
        title: t('Poker :date', {
            date: new Date().toLocaleDateString(locale, {
                dateStyle: 'medium',
            }),
        }),
        anonymous_votes: false,
        auto_reveal: false,
    });
    const errors = form.errors as Record<string, string | undefined>;

    const submit = (event: FormEvent) => {
        event.preventDefault();

        form.transform((data) => ({ ...data, ...deckPayload(deck) }));
        form.submit(
            TeamPokerGamesController.store({
                workspace: workspaceSlug,
                team: teamId,
            }),
            { onSuccess: onDone },
        );
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <DialogTitle>{t('New game')}</DialogTitle>

            <div className="grid gap-2">
                <Label htmlFor="new-poker-title">{t('Title')}</Label>
                <Input
                    id="new-poker-title"
                    value={form.data.title}
                    maxLength={120}
                    required
                    onChange={(event) =>
                        form.setData('title', event.target.value)
                    }
                />
                <InputError message={form.errors.title} />
            </div>

            <DeckFields
                deckOptions={deckOptions}
                value={deck}
                onChange={setDeck}
                errors={errors}
            />

            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="new-poker-anonymous"
                        checked={form.data.anonymous_votes}
                        onCheckedChange={(checked) =>
                            form.setData('anonymous_votes', checked === true)
                        }
                    />
                    <Label htmlFor="new-poker-anonymous">
                        {t('Anonymous votes')}
                    </Label>
                </div>
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="new-poker-auto-reveal"
                        checked={form.data.auto_reveal}
                        onCheckedChange={(checked) =>
                            form.setData('auto_reveal', checked === true)
                        }
                    />
                    <Label htmlFor="new-poker-auto-reveal">
                        {t('Reveal automatically')}
                    </Label>
                </div>
            </div>

            <DialogFooter className="gap-2">
                <Button type="button" variant="secondary" onClick={onDone}>
                    {t('Cancel')}
                </Button>
                <Button disabled={form.processing}>{t('Create game')}</Button>
            </DialogFooter>
        </form>
    );
}
```

`form.errors` carries `custom_cards.0`-style keys for card errors; `DeckFields` picks the first of them (Task 16).

- [ ] **Step 2: Team section**

Create `resources/js/components/teams/poker-games-section.tsx`:

```tsx
import { Link, usePage } from '@inertiajs/react';
import PokerGamesController from '@/actions/App/Http/Controllers/Poker/PokerGamesController';
import TeamEstimatesController from '@/actions/App/Http/Controllers/TeamEstimatesController';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { formatPoints } from '@/lib/poker/format';
import type { PokerDeckOption, PokerGameSummary } from '@/types';
import { NewPokerGameDialog } from './new-poker-game-dialog';

type Props = {
    workspaceSlug: string;
    teamId: string;
    games: PokerGameSummary[];
    deckOptions: PokerDeckOption[];
    canCreate: boolean;
};

export function PokerGamesSection({
    workspaceSlug,
    teamId,
    games,
    deckOptions,
    canCreate,
}: Props) {
    const { t } = useTrans();
    const active = games.filter((game) => game.endedAt === null);
    const ended = games.filter((game) => game.endedAt !== null);

    return (
        <section className="space-y-3">
            <Heading variant="small" title={t('Planning poker')} />

            <div className="flex flex-wrap items-center gap-2">
                {canCreate && (
                    <NewPokerGameDialog
                        workspaceSlug={workspaceSlug}
                        teamId={teamId}
                        deckOptions={deckOptions}
                    />
                )}
                <Button variant="outline" asChild>
                    <Link
                        href={TeamEstimatesController.index({
                            workspace: workspaceSlug,
                            team: teamId,
                        })}
                    >
                        {t('Estimation history')}
                    </Link>
                </Button>
            </div>

            {games.length === 0 && (
                <p className="text-muted-foreground">{t('No games yet.')}</p>
            )}

            {active.length > 0 && (
                <GameList title={t('Active games')} games={active} />
            )}
            {ended.length > 0 && (
                <GameList title={t('Ended games')} games={ended} />
            )}
        </section>
    );
}

function GameList({
    title,
    games,
}: {
    title: string;
    games: PokerGameSummary[];
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const formatDate = new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
    });

    return (
        <div className="space-y-1">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase">
                {title}
            </h3>
            <ul className="divide-y rounded-md border">
                {games.map((game) => (
                    <li key={game.id}>
                        <Link
                            href={PokerGamesController.show(game.id)}
                            className="flex flex-wrap items-center justify-between gap-2 p-3 hover:bg-muted"
                        >
                            <span>
                                <span className="block font-medium">
                                    {game.title}
                                </span>
                                <span className="block text-sm text-muted-foreground">
                                    {game.deckLabel}
                                    {' · '}
                                    {t(':tasks tasks · :estimated estimated', {
                                        tasks: game.tasksCount,
                                        estimated: game.estimatedCount,
                                    })}
                                    {game.totalPoints !== null &&
                                        ` · ${t(':points points', {
                                            points: formatPoints(
                                                game.totalPoints,
                                                locale,
                                            ),
                                        })}`}
                                </span>
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {t('Last activity :date', {
                                    date: formatDate.format(
                                        new Date(game.lastActivityAt),
                                    ),
                                })}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
```

- [ ] **Step 3: Team page**

Edit `resources/js/pages/teams/show.tsx`:

1. Imports — add after the `NewRetroDialog` import:

```tsx
import { PokerGamesSection } from '@/components/teams/poker-games-section';
```

and extend the `@/types` import list (keep alphabetical order):

```tsx
import type {
    CatalogueTemplate,
    CategoryOption,
    LlmAvailability,
    MemberSummary,
    PokerDeckOption,
    PokerGameSummary,
    RetroSummary,
    TeamHealthStatement,
    TeamSummary,
    WorkspaceSummary,
} from '@/types';
```

2. `Props` — append after `llm: LlmAvailability;`:

```tsx
    pokerGames: PokerGameSummary[];
    pokerDeckOptions: PokerDeckOption[];
    canCreatePokerGame: boolean;
```

3. Destructuring — append after `llm,` in the parameter list of `ShowTeam`:

```tsx
    pokerGames,
    pokerDeckOptions,
    canCreatePokerGame,
```

4. Section — insert between the closing `</section>` of the Retrospectives section and `<HealthStatementsSection`:

```tsx
                <PokerGamesSection
                    workspaceSlug={workspace.slug}
                    teamId={team.id}
                    games={pokerGames}
                    deckOptions={pokerDeckOptions}
                    canCreate={canCreatePokerGame}
                />
```

- [ ] **Step 4: Estimation history page**

Replace `resources/js/pages/poker/estimates.tsx` entirely:

```tsx
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useState, type FormEvent } from 'react';
import TeamEstimatesController from '@/actions/App/Http/Controllers/TeamEstimatesController';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import { formatAverage } from '@/lib/poker/format';
import type { PokerRound } from '@/lib/poker/types';
import type {
    EstimatedTaskRow,
    TeamSummary,
    WorkspaceSummary,
} from '@/types';

const AllGames = 'all';

type Filters = { game: string | null; q: string };

type Props = {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    games: { id: string; title: string }[];
    filters: Filters;
    tasks: EstimatedTaskRow[];
    pagination: { currentPage: number; lastPage: number; total: number };
};

function filterQuery(filters: Filters, page?: number) {
    return {
        ...(filters.game ? { game: filters.game } : {}),
        ...(filters.q.trim() !== '' ? { q: filters.q.trim() } : {}),
        ...(page && page > 1 ? { page } : {}),
    };
}

export default function PokerEstimates({
    workspace,
    team,
    games,
    filters,
    tasks,
    pagination,
}: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [search, setSearch] = useState(filters.q);
    const [expanded, setExpanded] = useState<string | null>(null);
    const params = { workspace: workspace.slug, team: team.id };
    const formatDate = new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
    });

    const apply = (changes: Partial<Filters>) => {
        router.get(
            TeamEstimatesController.index.url(params, {
                query: filterQuery({ ...filters, ...changes }),
            }),
            {},
            { preserveState: true, replace: true },
        );
    };

    const submitSearch = (event: FormEvent) => {
        event.preventDefault();
        apply({ q: search });
    };

    const pageUrl = (page: number) =>
        TeamEstimatesController.index.url(params, {
            query: filterQuery(filters, page),
        });

    return (
        <>
            <Head title={t('Estimation history')} />
            <div className="space-y-6 p-4">
                <Heading title={t('Estimation history')} description={team.name} />

                <Link
                    href={TeamsController.show(params)}
                    className="text-sm text-muted-foreground hover:text-foreground"
                >
                    {t('Back to the team')}
                </Link>

                <div className="flex flex-wrap items-center gap-2">
                    <Select
                        value={filters.game ?? AllGames}
                        onValueChange={(value) =>
                            apply({ game: value === AllGames ? null : value })
                        }
                    >
                        <SelectTrigger
                            className="w-56"
                            aria-label={t('Game')}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={AllGames}>
                                {t('All games')}
                            </SelectItem>
                            {games.map((game) => (
                                <SelectItem key={game.id} value={game.id}>
                                    {game.title}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <form onSubmit={submitSearch} className="flex gap-2">
                        <Input
                            type="search"
                            value={search}
                            placeholder={t('Search tasks')}
                            aria-label={t('Search tasks')}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                        <Button type="submit" variant="outline">
                            {t('Search')}
                        </Button>
                    </form>
                </div>

                {tasks.length === 0 ? (
                    <p className="text-muted-foreground">
                        {t('No estimated tasks yet.')}
                    </p>
                ) : (
                    <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-left">
                                <tr>
                                    <th className="p-2" />
                                    <th className="p-2 font-medium">
                                        {t('Task')}
                                    </th>
                                    <th className="p-2 font-medium">
                                        {t('Game')}
                                    </th>
                                    <th className="p-2 font-medium">
                                        {t('Estimate')}
                                    </th>
                                    <th className="p-2 font-medium">
                                        {t('Rounds')}
                                    </th>
                                    <th className="p-2 font-medium">
                                        {t('Date')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {tasks.map((task) => {
                                    const isOpen = expanded === task.id;

                                    return (
                                        <Fragment key={task.id}>
                                            <tr>
                                                <td className="p-2">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        aria-expanded={isOpen}
                                                        aria-label={
                                                            isOpen
                                                                ? t(
                                                                      'Hide rounds',
                                                                  )
                                                                : t(
                                                                      'Show rounds',
                                                                  )
                                                        }
                                                        onClick={() =>
                                                            setExpanded(
                                                                isOpen
                                                                    ? null
                                                                    : task.id,
                                                            )
                                                        }
                                                    >
                                                        {isOpen ? (
                                                            <ChevronDown className="size-4" />
                                                        ) : (
                                                            <ChevronRight className="size-4" />
                                                        )}
                                                    </Button>
                                                </td>
                                                <td className="p-2 font-medium">
                                                    {task.title}
                                                </td>
                                                <td className="p-2">
                                                    {task.gameTitle}
                                                </td>
                                                <td className="p-2">
                                                    <Badge variant="secondary">
                                                        {task.estimate}
                                                    </Badge>
                                                </td>
                                                <td className="p-2">
                                                    {task.roundsCount}
                                                </td>
                                                <td className="p-2 whitespace-nowrap">
                                                    {formatDate.format(
                                                        new Date(
                                                            task.estimatedAt,
                                                        ),
                                                    )}
                                                </td>
                                            </tr>
                                            {isOpen && (
                                                <tr>
                                                    <td
                                                        colSpan={6}
                                                        className="bg-muted/30 p-3"
                                                    >
                                                        <RoundList
                                                            task={task}
                                                            locale={locale}
                                                        />
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {pagination.lastPage > 1 && (
                    <nav
                        className="flex items-center justify-between gap-2 text-sm"
                        aria-label={t('Pagination')}
                    >
                        {pagination.currentPage > 1 ? (
                            <Link
                                href={pageUrl(pagination.currentPage - 1)}
                                preserveScroll
                            >
                                {t('Previous')}
                            </Link>
                        ) : (
                            <span />
                        )}
                        <span className="text-muted-foreground">
                            {t('Page :page of :total', {
                                page: pagination.currentPage,
                                total: pagination.lastPage,
                            })}
                        </span>
                        {pagination.currentPage < pagination.lastPage ? (
                            <Link
                                href={pageUrl(pagination.currentPage + 1)}
                                preserveScroll
                            >
                                {t('Next')}
                            </Link>
                        ) : (
                            <span />
                        )}
                    </nav>
                )}
            </div>
        </>
    );
}

function RoundList({
    task,
    locale,
}: {
    task: EstimatedTaskRow;
    locale: string;
}) {
    const { t } = useTrans();
    const nameOf = (playerId: string) =>
        task.players.find((player) => player.id === playerId)?.name ??
        t('Former member');

    return (
        <ul className="space-y-3">
            {task.rounds.map((round) => (
                <li key={round.id} className="space-y-1">
                    <p className="font-medium">
                        {t('Round :number', { number: round.number })}
                    </p>
                    {round.anonymous ? (
                        <p className="text-muted-foreground">
                            {t('Anonymous votes')}
                        </p>
                    ) : (
                        <ul className="flex flex-wrap gap-x-4 gap-y-1">
                            {round.votes.map((vote) => (
                                <li key={vote.playerId}>
                                    {nameOf(vote.playerId)}:{' '}
                                    <span className="font-mono">
                                        {vote.value ?? '—'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <RoundResult round={round} locale={locale} />
                </li>
            ))}
        </ul>
    );
}

function RoundResult({
    round,
    locale,
}: {
    round: PokerRound;
    locale: string;
}) {
    const { t } = useTrans();
    const result = round.result;

    if (result === null) {
        return null;
    }

    return (
        <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
            {result.distribution.map((entry) => (
                <span key={entry.value} className="font-mono">
                    {entry.value} × {entry.count}
                </span>
            ))}
            {result.average !== null && (
                <span>
                    {t('Average')}: {formatAverage(result.average, locale)}
                </span>
            )}
            {result.average === null && result.mode.length > 0 && (
                <span>
                    {t('Most played: :cards', {
                        cards: result.mode.join(', '),
                    })}
                </span>
            )}
            {result.average === null && result.mode.length === 0 && (
                <span>{t('No countable votes')}</span>
            )}
            {result.consensus && (
                <Badge variant="outline">{t('Consensus')}</Badge>
            )}
        </p>
    );
}
```

The anonymous branch is forward-compatible with Plan 10b: until then no round is anonymous. `Former member` already exists in `lang/*.json` (retro participants use it).

- [ ] **Step 5: Translations**

Append to each file (skip keys already present at execution time; `Title`, `Cancel`, `Previous`, `Next`, `Pagination`, `Page :page of :total`, `Back to the team`, `Former member` exist; `Round :number` comes from Task 14; `Estimate`, `Average`, `Most played: :cards`, `Consensus`, `No countable votes` come from Task 15):

`lang/en.json`:
```json
    "Planning poker": "Planning poker",
    "New game": "New game",
    "Poker :date": "Poker :date",
    "Anonymous votes": "Anonymous votes",
    "Reveal automatically": "Reveal automatically",
    "Create game": "Create game",
    "Estimation history": "Estimation history",
    "Active games": "Active games",
    "Ended games": "Ended games",
    "No games yet.": "No games yet.",
    ":tasks tasks · :estimated estimated": ":tasks tasks · :estimated estimated",
    ":points points": ":points points",
    "Last activity :date": "Last activity :date",
    "All games": "All games",
    "Search tasks": "Search tasks",
    "Search": "Search",
    "Task": "Task",
    "Game": "Game",
    "Rounds": "Rounds",
    "Date": "Date",
    "No estimated tasks yet.": "No estimated tasks yet.",
    "Show rounds": "Show rounds",
    "Hide rounds": "Hide rounds"
```

`lang/fr.json`:
```json
    "Planning poker": "Planning poker",
    "New game": "Nouvelle partie",
    "Poker :date": "Poker :date",
    "Anonymous votes": "Votes anonymes",
    "Reveal automatically": "Révéler automatiquement",
    "Create game": "Créer la partie",
    "Estimation history": "Historique des estimations",
    "Active games": "Parties en cours",
    "Ended games": "Parties terminées",
    "No games yet.": "Aucune partie pour l'instant.",
    ":tasks tasks · :estimated estimated": ":tasks tâches · :estimated estimées",
    ":points points": ":points points",
    "Last activity :date": "Dernière activité :date",
    "All games": "Toutes les parties",
    "Search tasks": "Rechercher des tâches",
    "Search": "Rechercher",
    "Task": "Tâche",
    "Game": "Partie",
    "Rounds": "Tours",
    "Date": "Date",
    "No estimated tasks yet.": "Aucune tâche estimée pour l'instant.",
    "Show rounds": "Afficher les tours",
    "Hide rounds": "Masquer les tours"
```

`lang/es.json`:
```json
    "Planning poker": "Planning poker",
    "New game": "Nueva partida",
    "Poker :date": "Poker :date",
    "Anonymous votes": "Votos anónimos",
    "Reveal automatically": "Revelar automáticamente",
    "Create game": "Crear partida",
    "Estimation history": "Historial de estimaciones",
    "Active games": "Partidas activas",
    "Ended games": "Partidas terminadas",
    "No games yet.": "Todavía no hay partidas.",
    ":tasks tasks · :estimated estimated": ":tasks tareas · :estimated estimadas",
    ":points points": ":points puntos",
    "Last activity :date": "Última actividad :date",
    "All games": "Todas las partidas",
    "Search tasks": "Buscar tareas",
    "Search": "Buscar",
    "Task": "Tarea",
    "Game": "Partida",
    "Rounds": "Rondas",
    "Date": "Fecha",
    "No estimated tasks yet.": "Todavía no hay tareas estimadas.",
    "Show rounds": "Mostrar rondas",
    "Hide rounds": "Ocultar rondas"
```

`lang/de.json`:
```json
    "Planning poker": "Planning Poker",
    "New game": "Neues Spiel",
    "Poker :date": "Poker :date",
    "Anonymous votes": "Anonyme Stimmen",
    "Reveal automatically": "Automatisch aufdecken",
    "Create game": "Spiel erstellen",
    "Estimation history": "Schätzungsverlauf",
    "Active games": "Laufende Spiele",
    "Ended games": "Beendete Spiele",
    "No games yet.": "Noch keine Spiele.",
    ":tasks tasks · :estimated estimated": ":tasks Aufgaben · :estimated geschätzt",
    ":points points": ":points Punkte",
    "Last activity :date": "Letzte Aktivität :date",
    "All games": "Alle Spiele",
    "Search tasks": "Aufgaben suchen",
    "Search": "Suchen",
    "Task": "Aufgabe",
    "Game": "Spiel",
    "Rounds": "Runden",
    "Date": "Datum",
    "No estimated tasks yet.": "Noch keine geschätzten Aufgaben.",
    "Show rounds": "Runden anzeigen",
    "Hide rounds": "Runden ausblenden"
```

- [ ] **Step 6: Checks**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check`
Expected: only the known pre-existing failures.

Run: `npx vp check --fix resources/js/components/teams/poker-games-section.tsx resources/js/components/teams/new-poker-game-dialog.tsx resources/js/pages/teams/show.tsx resources/js/pages/poker/estimates.tsx`

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php tests/Feature/Poker/TeamPokerSectionTest.php tests/Feature/Poker/PokerEstimatesPageTest.php tests/Feature/Teams`
Expected: PASS (the Inertia component files exist; props unchanged).

- [ ] **Step 7: Commit**

```bash
git add resources/js/components/teams/poker-games-section.tsx resources/js/components/teams/new-poker-game-dialog.tsx resources/js/pages/teams/show.tsx resources/js/pages/poker/estimates.tsx lang/en.json lang/fr.json lang/es.json lang/de.json
git commit -m "feat: add planning poker to the team page and the estimation history page

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

#### Implementer notes

- `formatPoints` is used for the team list's point total (outline Task 13 declares it in `@/lib/poker/format`); `formatAverage` for the history page. Both must exist when this task runs.
- The estimates page renders `task.players` names for revealed votes; Task 11 must include every voter of the presented rounds in `players` (the outline says so), otherwise names fall back to "Former member".

### Task 18: Verification (controller-driven)

**Files:** none new (fixes only, each in its own commit with a `fix:` message and the two trailer lines).

**Interfaces:**
- Consumes: everything of Tasks 1–17.
- Produces: green automated checks, the 10a-scope two-browser walkthrough recorded in the ledger, and the user's full-suite run.

- [ ] **Step 1: Poker, retro regression and global tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Poker tests/Unit/Poker tests/Feature/Retros tests/Feature/Teams tests/Feature/TranslationKeysTest.php tests/Feature/UuidPrimaryKeysTest.php`
Expected: all green. The retro suites prove the `HasGuestIdentity` / `GuestCookie` extraction (Task 1) changed no retro behaviour.

- [ ] **Step 2: Static checks**

Run: `vendor/bin/sail bin phpstan analyse --no-progress` — expected 0 errors.
Run: `vendor/bin/sail bin pint --dirty --format agent` — expected clean (commit any formatting it applies as `style: format planning poker code`).

- [ ] **Step 3: Frontend checks and build**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check`
Expected: only the known pre-existing failures in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`.
Run: `npm run build` — expected success (SSR-safe: no `echo()` or `window` access during render in the poker components).

- [ ] **Step 4: Full suite (user)**

Ask the user to run `vendor/bin/sail artisan test --compact` and report the result; do not claim it green before they do.

- [ ] **Step 5: Two-browser walkthrough (10a scope)**

Prerequisites: `vendor/bin/sail up -d`, `vendor/bin/sail artisan migrate`, Reverb running (`vendor/bin/sail artisan reverb:start` or the compose service), `npm run dev` (or `npm run build`). Browser A: a team member (logged in). Browser B: a private window, logged out. Drive step by step with the user; after each step the user confirms or reports the difference.

1. **Team page (A).** Open the team: a "Planning poker" section sits under Retrospectives with "New game" and "Estimation history"; "No games yet.".
2. **Create (A).** "New game": default title "Poker <today>", deck list shows the five decks with their cards; pick Custom, type `1, 2, 3, 5, 8`, keep "Add ?" and "Add ☕"; create. Expected: redirect to the game; header shows the title, deck label "Custom", facilitator menu; empty state "Add the first task".
3. **Custom deck validation (A).** Back on the team page, try a custom deck `3,  3` → inline error "Each card can appear only once."; `?, ☕` only → "Add at least one card that can be an estimate.". Cancel.
4. **Tasks (A).** Add three tasks, one with a Markdown description containing `**bold**`, a link and `<script>alert(1)</script>`. Expected: tasks appear in order; the description renders bold, the link opens in a new tab, the script shows as text. Drag the third task to the top; reload: order kept.
5. **Guest link (A).** Facilitator menu → "Guest link…" → "Allow guests" → copy the link.
6. **Join (B).** Open the link: "Join a planning poker game" form; join as "Visitor". Expected: B sees the game, both avatars in the presence strip of A and B, B has no back arrow, no "Add task" button, a language switcher.
7. **Select and vote (A, B).** A clicks the first task: both browsers show it as current with "Show votes" disabled for A. B plays `5`: A sees B's card face-down within a second (no value anywhere; check DevTools → Network/WS in A for the `vote.changed` frame: no `5`). A plays `8`; B changes to `3`, then clicks `3` again (withdraw) and plays `3` again.
8. **Reveal (A).** "Show votes": both browsers show both cards face-up (`8`, `3`), average `5.5`, nearest card `5`, distribution bars in deck order, no "Consensus". The hand is disabled in both.
9. **Re-vote and estimate (A, B).** "Re-vote": new empty round for both; both play `5`; reveal → "Consensus", nearest card `5`. The estimate select is preselected with `5`; "Save estimate": the task shows the `5` chip in both browsers. Open "Rounds (2)" on the task: round 2 and round 1 with names and values.
10. **Next task (A).** "Next task" selects the next unestimated task; B votes, then A deletes that current task from its detail. Expected: both browsers drop the current task ("Waiting for the facilitator to pick a task" in B).
11. **Reconnect (B).** DevTools → Network → Offline for ~10 s: "Reconnecting…" banner; meanwhile A adds a task; back Online: banner disappears, B shows the new task without reload.
12. **End and reopen (A).** Facilitator menu → "End game" → confirm. Expected: "Game ended" badge in both; hand, "Add task" and selection disabled; B's attempt to vote is impossible (disabled). Reopen → everything editable again.
13. **Take control (A + third window C, a second team member).** C opens the game and clicks "Take control": C becomes facilitator in all browsers; A's facilitator entries disappear; C hands facilitation back to A via "Hand over facilitation…". Then A ends the game; C clicks "Take control" on the ended game, becomes facilitator and reopens it.
14. **Regenerate (A).** Guest link dialog → "Create a new link". Expected: B's next action (e.g. playing a card after selecting a task) shows the session-expired banner; opening the old link shows "This guest link is no longer valid."
15. **History (A).** Team page → the game row shows ":tasks tasks · 1 estimated · 5 points" and its last activity; "Estimation history" lists the estimated task; filter by game and by a title fragment; expanding the row shows both revealed rounds with names, values and results.
16. **Delete (A with B re-joined through the new link).** Facilitator menu → "Delete game…" → confirm. Expected: A lands on the team page; B shows "This game was deleted." (no team link for the guest).

Record each step's outcome (pass / fail with what was seen) in the execution ledger under `.superpowers/sdd/<run>/progress.md`, section "Task 18 walkthrough". Any failure: reproduce, add a failing test where the behaviour is server-side, fix in its own commit, re-run Steps 1–3 for the touched area and repeat the walkthrough step.

Note on step 8: the average of `8` and `3` is `5.5`; the nearest numeric card of the custom deck `1 2 3 5 8` is `5` (distance 0.5) — the tie rule (higher card) applies only to equal distances, e.g. `2` and `3` → `2.5` → `3`. Use that pair in step 9's first attempt if the user wants to see the tie rule.

- [ ] **Step 6: Ledger and wrap-up**

In the ledger, note: the commit range of Plan 10a, the test and static-check results with counts, the walkthrough outcome, and open rulings to confirm with the user (request fields snake_case; the five snapshot additions of "Spec amendments made with this plan"). Plan 10b continues on the same branch.
