# Plan 7 — Board engagement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Live cursors (mouse, touch, pen), flying emoji, per-card emoji reactions with a full picker, threaded card comments with live notifications, GIFs in cards through a server proxy, and six facilitator board settings (reactions, cursors, GIFs, hide vote counts, close for editing, presentation mode).

**Architecture:** Persisted features follow the existing pattern — a controller guarded by `RetroGuard` under a `lockForUpdate` on the retro row, a presenter action, a `RetroBroadcastEvent` sent after commit to others, a reducer action on the client. The lock ("close for editing") is one more `RetroGuard` check (HTTP 423) added to every content mutation. Ephemeral features (cursors, flying reactions) are Reverb client events (whispers) on the existing presence channel through a small skrum transport that takes the sender id from the `user_id` Reverb stamps on every client event in `members` mode, so ids cannot be spoofed; the `live-cursors` / `live-reactions` libraries do throttling, TTL, clustering and rendering. GIFs are searched and streamed by the server (`GifCatalog` + GIPHY/Tenor providers) so browsers never contact the provider.

**Tech Stack:** Laravel 13 (PHP 8.4), Reverb (`accept_client_events_from = members`), Pest, React 19, Inertia v3, `@laravel/echo-react`, `live-cursors` 0.2, `live-reactions` 0.2, `frimousse` 0.4, Wayfinder, Tailwind 4, lucide.

**Spec:** `docs/superpowers/specs/2026-09-29-board-engagement-design.md` (parent: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md`; research: `docs/superpowers/research/qretro/repos.md`).

## Global Constraints

- Commands through Sail: `vendor/bin/sail artisan …`, `vendor/bin/sail bin pint --dirty --format agent`, `vendor/bin/sail bin phpstan analyse --no-progress` (level 7, 0 errors). npm on the host.
- New npm dependencies: exactly `live-cursors`, `live-reactions`, `frimousse`. No composer dependencies.
- Redaction invariant from the parent spec: nobody but the author receives `Writing`-phase content (now including GIFs), anonymous authorship (cards, comments, reactions, notifications, cursor labels) is never serialized to others, and voter identity is never exposed.
- Every mutation keeps the controller pattern: guards on the route-bound retro, then again on the `lockForUpdate` retro inside `DB::transaction`, broadcasts via `->sendToOthers()` inside the transaction.
- Every user-facing string via `t()` / `__()` with real translations in `lang/{en,fr,es,de}.json` (German "du", French "vous", Spanish "tú"); add only missing keys; `tests/Feature/TranslationKeysTest.php` stays green.
- Board API calls go through `retroRequest()`; Wayfinder route functions, no hard-coded URLs. Run `vendor/bin/sail artisan wayfinder:generate --with-form` after route changes.
- Frontend checks: `npm run types:check && npm run check` (known pre-existing failures only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`). Format only touched files with `npx vp fmt <files>`; never `npx prettier` on the repo.
- React style: function components, `type Props`, no default exports except pages, Tailwind, lucide icons, `useBoard()` for board state.
- PHP style: constructor promotion, typed everything, array-shape docblocks for presenter return values, early returns, curly braces always, no comments that restate code.
- Commit messages: Conventional Commits, ending with exactly:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS`

## Review Focus

1. **Comment, reaction or GIF request for a card of another retro (tampered URL)** → 404, nothing written. Pinned by "returns 404 for cards and comments of another retro" tests in Tasks 3 and 4 (route `scopeBindings()`).
2. **Reply whose `parentCommentId` is a reply, or a comment of another card** → the reply attaches to the top-level comment, or 422. Pinned in Task 4.
3. **Deleting the last reply of a soft-deleted parent** → the parent disappears too and both deletions are broadcast. Pinned in Task 4.
4. **GIF proxy asked for an unknown id, or the provider is down** → 404 / 502, and the provider key never appears in any response. Pinned in Task 5.
5. **Facilitator steps back from `Grouping` to `Writing` after reactions, comments and GIFs exist** → others' cards carry no content, GIF, reactions or comments in the snapshot. Pinned in Task 5 (snapshot redaction test).

## File map

| Area | Files |
|---|---|
| Settings + lock | migration `add_engagement_settings_to_retros_table`, `app/Models/Retro.php`, `app/Actions/Retros/RetroGuard.php`, `RetroSettingsController`, `CardsController`, `CardPositionsController`, `CardGroupsController`, `CardVotesController`, `ActionItemsController`, `BuildBoardSnapshot` |
| Vote totals | `VoteCast`, `VoteRetracted`, `CardVotesController`, `BuildBoardSnapshot` |
| Reactions | `app/Rules/SingleEmoji.php`, migration `create_card_reactions_table`, `app/Models/CardReaction.php`, `app/Actions/Retros/SummarizeReactions.php`, `app/Http/Controllers/Retros/CardReactionsController.php`, `app/Events/Retros/CardReactionsChanged.php` |
| Comments | migration `create_card_comments_table`, `app/Models/CardComment.php`, `app/Actions/Retros/PresentComment.php`, `app/Http/Controllers/Retros/CardCommentsController.php`, events `CommentCreated`, `CommentUpdated`, `CommentDeleted`, `OwnCommentSaved`, `CommentNotification` |
| GIFs | `config/services.php`, `.env.example`, `app/Support/Gifs/{Gif,GifProvider,GiphyProvider,TenorProvider,GifCatalog}.php`, `app/Http/Controllers/Retros/RetroGifsController.php`, `app/Http/Controllers/GifsController.php`, migration `add_gif_to_cards_table`, `PresentCard`, `AppServiceProvider` (rate limiter) |
| Frontend core | `resources/js/lib/retro/{types,board-reducer,emoji,whisper-transport}.ts`, `resources/js/hooks/{use-retro-channel,use-retro-board,use-local-preference,use-comment-notifications}.ts`, `board-context.tsx`, `board.tsx` |
| Frontend UI | `resources/js/components/retro/{emoji-picker,card-reactions,card-comments,gif-picker,card-gif,live-cursor-layer,flying-reactions,presentation-overlay,lock-badge}.tsx`, `retro-card.tsx`, `card-composer.tsx`, `card-editor.tsx`, `vote-controls.tsx`, `settings-dialog.tsx`, `board-header.tsx`, `presence-strip.tsx`, `action-items-panel.tsx`, `retro-column.tsx` |

---

### Task 1: Engagement settings and "close for editing"

**Files:**
- Create: `database/migrations/2026_09_30_090000_add_engagement_settings_to_retros_table.php`
- Modify: `app/Models/Retro.php`, `app/Actions/Retros/RetroGuard.php`, `app/Http/Controllers/Retros/RetroSettingsController.php`, `app/Actions/Retros/BuildBoardSnapshot.php`
- Modify (lock guard): `app/Http/Controllers/Retros/{CardsController,CardPositionsController,CardGroupsController,CardVotesController,ActionItemsController}.php`
- Modify: `lang/{en,fr,es,de}.json`
- Test: `tests/Feature/Retros/RetroGuardTest.php`, `tests/Feature/Retros/FacilitationTest.php`, create `tests/Feature/Retros/BoardLockTest.php`, `tests/Feature/Retros/BoardSnapshotTest.php`

**Interfaces:**
- Produces: `retros` columns `reactions_enabled` (true), `cursors_enabled` (true), `gifs_enabled` (true), `hide_vote_counts` (false), `is_locked` (false), `presentation_mode` (false); `RetroGuard::unlocked(Retro $retro): void` (throws `Symfony\Component\HttpKernel\Exception\HttpException` 423 "The board is closed for editing."); `RetroGuard::reactionsEnabled(Retro $retro): void` (403); snapshot `retro.reactionsEnabled`, `retro.cursorsEnabled`, `retro.gifsEnabled`, `retro.hideVoteCounts`, `retro.isLocked`, `retro.presentationMode` (all bool).

- [ ] **Step 1: Write the failing tests**

Append to `tests/Feature/Retros/RetroGuardTest.php` (add `use Symfony\Component\HttpKernel\Exception\HttpException;`):

```php
it('refuses changes to a board closed for editing with a 423', function () {
    $retro = Retro::factory()->make(['is_locked' => false]);

    RetroGuard::unlocked($retro);

    $retro->is_locked = true;

    expect(fn () => RetroGuard::unlocked($retro))
        ->toThrow(fn (HttpException $exception) => expect($exception->getStatusCode())->toBe(423)
            ->and($exception->getMessage())->toBe('The board is closed for editing.'));
});

it('refuses reactions when they are turned off', function () {
    $retro = Retro::factory()->make(['reactions_enabled' => false]);

    expect(fn () => RetroGuard::reactionsEnabled($retro))
        ->toThrow(AuthorizationException::class, 'Reactions are turned off for this board.');
});
```

Append to `tests/Feature/Retros/FacilitationTest.php`:

```php
it('updates the engagement settings and asks clients to refetch', function () {
    [$retro, $user] = facilitatedRetro(RetroPhase::Discussing);

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), [
        'reactions_enabled' => false,
        'cursors_enabled' => false,
        'gifs_enabled' => false,
        'hide_vote_counts' => true,
        'is_locked' => true,
        'presentation_mode' => true,
    ])->assertNoContent();

    expect($retro->fresh()->only([
        'reactions_enabled', 'cursors_enabled', 'gifs_enabled', 'hide_vote_counts', 'is_locked', 'presentation_mode',
    ]))->toBe([
        'reactions_enabled' => false,
        'cursors_enabled' => false,
        'gifs_enabled' => false,
        'hide_vote_counts' => true,
        'is_locked' => true,
        'presentation_mode' => true,
    ]);
    Event::assertDispatched(RetroSettingsChanged::class);
});

it('refuses engagement settings from others and once completed', function (string $setting) {
    [$retro, $facilitator] = facilitatedRetro();
    [$member] = retroMember($retro);

    $this->actingAs($member)->patchJson(route('retros.settings.update', $retro), [$setting => true])->assertForbidden();

    $retro->update(['phase' => RetroPhase::Completed]);

    $this->actingAs($facilitator)->patchJson(route('retros.settings.update', $retro), [$setting => true])->assertForbidden();
})->with(['reactions_enabled', 'cursors_enabled', 'gifs_enabled', 'hide_vote_counts', 'is_locked', 'presentation_mode']);
```

Create `tests/Feature/Retros/BoardLockTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Column;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('refuses board changes while the board is closed for editing', function (RetroPhase $phase, Closure $request) {
    $retro = Retro::factory()->inPhase($phase)->create(['is_locked' => true]);
    [$user, $participant] = retroFacilitator($retro);
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'participant_id' => $participant->id]);
    $other = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id]);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id]);

    $request($this->actingAs($user), $retro, $card, $other, $column, $item)
        ->assertStatus(423)
        ->assertJsonPath('message', 'The board is closed for editing.');
})->with([
    'write a card' => [RetroPhase::Writing, fn ($http, $retro, $card, $other, $column) => $http->postJson(route('retros.cards.store', $retro), ['column_id' => $column->id, 'content' => 'x'])],
    'edit a card' => [RetroPhase::Writing, fn ($http, $retro, $card) => $http->patchJson(route('retros.cards.update', [$retro, $card]), ['content' => 'y'])],
    'delete a card' => [RetroPhase::Writing, fn ($http, $retro, $card) => $http->deleteJson(route('retros.cards.destroy', [$retro, $card]))],
    'move a card' => [RetroPhase::Grouping, fn ($http, $retro, $card, $other, $column) => $http->putJson(route('retros.cards.position.update', [$retro, $card]), ['column_id' => $column->id, 'index' => 0])],
    'group a card' => [RetroPhase::Grouping, fn ($http, $retro, $card, $other) => $http->putJson(route('retros.cards.group.update', [$retro, $card]), ['parent_card_id' => $other->id])],
    'ungroup a card' => [RetroPhase::Grouping, fn ($http, $retro, $card) => $http->deleteJson(route('retros.cards.group.destroy', [$retro, $card]))],
    'vote' => [RetroPhase::Voting, fn ($http, $retro, $card) => $http->postJson(route('retros.cards.votes.store', [$retro, $card]))],
    'retract a vote' => [RetroPhase::Voting, fn ($http, $retro, $card) => $http->deleteJson(route('retros.cards.votes.destroy', [$retro, $card]))],
    'add an action item' => [RetroPhase::Discussing, fn ($http, $retro) => $http->postJson(route('retros.action-items.store', $retro), ['content' => 'Do it'])],
    'edit an action item' => [RetroPhase::Discussing, fn ($http, $retro, $card, $other, $column, $item) => $http->patchJson(route('retros.action-items.update', [$retro, $item]), ['is_done' => true])],
    'delete an action item' => [RetroPhase::Discussing, fn ($http, $retro, $card, $other, $column, $item) => $http->deleteJson(route('retros.action-items.destroy', [$retro, $item]))],
]);

it('keeps facilitation available while the board is closed for editing', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['is_locked' => true]);
    [$user] = retroFacilitator($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $card->id])->assertOk();
    $this->actingAs($user)->putJson(route('retros.timer.update', $retro), ['seconds' => 60])->assertOk();
    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['is_locked' => false])->assertNoContent();
    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'completed'])->assertOk();
});
```

(Check the success status of the timer and phase endpoints with the existing `FacilitationTest` cases — `assertOk()` or `assertNoContent()` — and use the same assertion.)

Append to `tests/Feature/Retros/BoardSnapshotTest.php`:

```php
it('describes the engagement settings', function () {
    $retro = Retro::factory()->create(['cursors_enabled' => false, 'is_locked' => true]);
    [, $viewer] = retroMember($retro);

    expect(snapshotFor($retro, $viewer)['retro'])->toMatchArray([
        'reactionsEnabled' => true,
        'cursorsEnabled' => false,
        'gifsEnabled' => true,
        'hideVoteCounts' => false,
        'isLocked' => true,
        'presentationMode' => false,
    ]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/RetroGuardTest.php tests/Feature/Retros/FacilitationTest.php tests/Feature/Retros/BoardLockTest.php tests/Feature/Retros/BoardSnapshotTest.php`
Expected: FAIL — unknown columns / methods, 200s instead of 423.

- [ ] **Step 3: Migration and model**

Run: `vendor/bin/sail artisan make:migration add_engagement_settings_to_retros_table --no-interaction` and rename the file to `2026_09_30_090000_add_engagement_settings_to_retros_table.php` (it must sort after `2026_09_29_181529_…`).

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
            $table->boolean('reactions_enabled')->default(true);
            $table->boolean('cursors_enabled')->default(true);
            $table->boolean('gifs_enabled')->default(true);
            $table->boolean('hide_vote_counts')->default(false);
            $table->boolean('is_locked')->default(false);
            $table->boolean('presentation_mode')->default(false);
        });
    }
};
```

`app/Models/Retro.php`: add `@property bool $reactions_enabled`, `@property bool $cursors_enabled`, `@property bool $gifs_enabled`, `@property bool $hide_vote_counts`, `@property bool $is_locked`, `@property bool $presentation_mode` to the docblock; append the six names to `#[Fillable([...])]`; add the six to `casts()` as `'boolean'`.

- [ ] **Step 4: Guards**

`app/Actions/Retros/RetroGuard.php` (import `Symfony\Component\HttpKernel\Exception\HttpException`):

```php
    public static function unlocked(Retro $retro): void
    {
        if (! $retro->is_locked) {
            return;
        }

        throw new HttpException(423, __('The board is closed for editing.'));
    }

    public static function reactionsEnabled(Retro $retro): void
    {
        if ($retro->reactions_enabled) {
            return;
        }

        throw new AuthorizationException(__('Reactions are turned off for this board.'));
    }
```

- [ ] **Step 5: Enforce the lock**

In each method below, add `RetroGuard::unlocked($retro);` right after the existing first `RetroGuard::phase($retro, …)` call, and `RetroGuard::unlocked($locked);` right after the existing `RetroGuard::phase($locked, …)` call inside the transaction:
- `CardsController::store`, `::update`, `::destroy`
- `CardPositionsController::update`
- `CardGroupsController::update`, `::destroy`
- `CardVotesController::store`, `::destroy`
- `ActionItemsController::store`, `::update`, `::destroy`

- [ ] **Step 6: Settings**

`RetroSettingsController::update`: extend the validation array with

```php
            'reactions_enabled' => ['sometimes', 'boolean'],
            'cursors_enabled' => ['sometimes', 'boolean'],
            'gifs_enabled' => ['sometimes', 'boolean'],
            'hide_vote_counts' => ['sometimes', 'boolean'],
            'is_locked' => ['sometimes', 'boolean'],
            'presentation_mode' => ['sometimes', 'boolean'],
```

and add a class constant plus a check inside the transaction, after `RetroGuard::facilitator($locked, $participant);`:

```php
    private const EngagementSettings = [
        'reactions_enabled', 'cursors_enabled', 'gifs_enabled', 'hide_vote_counts', 'is_locked', 'presentation_mode',
    ];
```

```php
            if (array_intersect(array_keys($validated), self::EngagementSettings) !== []) {
                RetroGuard::phase($locked, RetroPhase::Writing, RetroPhase::Grouping, RetroPhase::Voting, RetroPhase::Discussing);
            }
```

- [ ] **Step 7: Snapshot**

`BuildBoardSnapshot::handle`, in the `'retro'` array after `'isAnonymous'`:

```php
                'reactionsEnabled' => $retro->reactions_enabled,
                'cursorsEnabled' => $retro->cursors_enabled,
                'gifsEnabled' => $retro->gifs_enabled,
                'hideVoteCounts' => $retro->hide_vote_counts,
                'isLocked' => $retro->is_locked,
                'presentationMode' => $retro->presentation_mode,
```

- [ ] **Step 8: Translations**

| key | fr | es | de |
|---|---|---|---|
| The board is closed for editing. | Le tableau est fermé aux modifications. | El tablero está cerrado a los cambios. | Das Board ist für Änderungen gesperrt. |
| Reactions are turned off for this board. | Les réactions sont désactivées pour ce tableau. | Las reacciones están desactivadas en este tablero. | Reaktionen sind für dieses Board ausgeschaltet. |

- [ ] **Step 9: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan migrate --no-interaction && vendor/bin/sail artisan test --compact tests/Feature/Retros tests/Feature/TranslationKeysTest.php`
Expected: PASS (all existing retro tests too).

- [ ] **Step 10: Format, analyse, commit**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress` → clean.

```bash
git add database/migrations app lang tests
git commit -m "feat: add engagement settings and close boards for editing"
```

---

### Task 2: Vote totals visible during Voting unless hidden (parity)

**Files:**
- Modify: `app/Events/Retros/VoteCast.php`, `app/Events/Retros/VoteRetracted.php`, `app/Http/Controllers/Retros/CardVotesController.php`, `app/Actions/Retros/BuildBoardSnapshot.php`
- Test: `tests/Feature/Retros/VotingTest.php`, `tests/Feature/Retros/BoardSnapshotTest.php`

**Interfaces:**
- Consumes: Task 1 `hide_vote_counts`.
- Produces: `VoteCast` / `VoteRetracted` constructor `(string $retroId, int $votesCast, int $votesVersion, ?array $cardTotal = null)` where `$cardTotal` is `array{cardId: string, total: int}`; `broadcastWith()` = `{votesCast, votesVersion}` plus `cardId`, `total` when `$cardTotal` is set; vote responses gain `total: ?int` (the card's total, null when hidden); snapshot `cards[].votes` is the total during `Voting` when `hide_vote_counts` is false.

- [ ] **Step 1: Write the failing tests**

In `tests/Feature/Retros/VotingTest.php`, change the first test so it covers the hidden case and add the visible one:

```php
it('casts votes and broadcasts only the overall count when vote counts are hidden', function () {
    [$retro, $user, $participant, $card] = votingRetro();
    $retro->update(['hide_vote_counts' => true]);

    $this->actingAs($user)
        ->postJson(route('retros.cards.votes.store', [$retro, $card]))
        ->assertCreated()
        ->assertJson(['cardId' => $card->id, 'myVotes' => 1, 'remainingVotes' => 2, 'total' => null]);

    Event::assertDispatched(VoteCast::class, fn (VoteCast $event) => $event->votesCast === 1
        && array_keys($event->broadcastWith()) === ['votesCast', 'votesVersion']);
});

it('broadcasts the card total while voting when vote counts are visible', function () {
    [$retro, $user, $participant, $card] = votingRetro();
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $this->actingAs($user)
        ->postJson(route('retros.cards.votes.store', [$retro, $card]))
        ->assertCreated()
        ->assertJsonPath('total', 2);

    Event::assertDispatched(VoteCast::class, fn (VoteCast $event) => $event->broadcastWith() === [
        'votesCast' => 2,
        'votesVersion' => 1,
        'cardId' => $card->id,
        'total' => 2,
    ]);

    $this->actingAs($user)
        ->deleteJson(route('retros.cards.votes.destroy', [$retro, $card]))
        ->assertOk()
        ->assertJsonPath('total', 1);

    Event::assertDispatched(VoteRetracted::class, fn (VoteRetracted $event) => $event->broadcastWith()['total'] === 1
        && ! str_contains(json_encode($event->broadcastWith()), $user->id));
});
```

In `tests/Feature/Retros/BoardSnapshotTest.php`, change the dataset test so that `Voting` covers both settings:

```php
it('shows vote totals while voting unless hidden, and always shows own votes', function (RetroPhase $phase, bool $hidden, ?int $expectedTotal) {
    $retro = Retro::factory()->inPhase($phase)->create(['hide_vote_counts' => $hidden]);
    [, $viewer] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $viewer->id]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $snapshot = snapshotFor($retro, $viewer);

    expect(snapshotCard($snapshot, $card))->toMatchArray(['votes' => $expectedTotal, 'myVotes' => 2])
        ->and($snapshot['viewer']['remainingVotes'])->toBe(3);
})->with([
    'voting, hidden' => [RetroPhase::Voting, true, null],
    'voting, visible' => [RetroPhase::Voting, false, 3],
    'discussing, hidden' => [RetroPhase::Discussing, true, 3],
    'completed' => [RetroPhase::Completed, false, 3],
]);
```

(Replace the old "hides vote totals until discussing but always shows own votes" test with this one.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/VotingTest.php tests/Feature/Retros/BoardSnapshotTest.php`
Expected: FAIL — no `total`, snapshot `votes` null while voting.

- [ ] **Step 3: Events**

`VoteCast.php` (same change in `VoteRetracted.php`):

```php
    /**
     * @param  array{cardId: string, total: int}|null  $cardTotal
     */
    public function __construct(string $retroId, public int $votesCast, public int $votesVersion, public ?array $cardTotal = null)
    {
        parent::__construct($retroId);
    }

    public function broadcastWith(): array
    {
        return [
            'votesCast' => $this->votesCast,
            'votesVersion' => $this->votesVersion,
            ...($this->cardTotal ?? []),
        ];
    }
```

- [ ] **Step 4: Controller**

`CardVotesController`: in both transactions, after `$votesCast = $locked->votes()->count();`:

```php
            $total = $locked->hide_vote_counts ? null : $card->votes()->count();
            $cardTotal = $total === null ? null : ['cardId' => $card->id, 'total' => $total];
```

pass `$cardTotal` as the fourth constructor argument of `VoteCast` / `VoteRetracted`, and return `['votesCast' => $votesCast, 'votesVersion' => $locked->votes_version, 'total' => $total]`. In `destroy`, `$card` is the route-bound card (the vote row was deleted already, so its `votes()->count()` is current). `tally()` gains the `total` key: add `total: ?int` to both array-shape docblocks (`$totals` and the return) and `'total' => $totals['total'],` to the returned array.

- [ ] **Step 5: Snapshot**

`BuildBoardSnapshot::handle`:

```php
        $showsTotals = in_array($retro->phase, [RetroPhase::Discussing, RetroPhase::Completed], true)
            || ($retro->phase === RetroPhase::Voting && ! $retro->hide_vote_counts);
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros`
Expected: PASS.

- [ ] **Step 7: Format, analyse, commit**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress` → clean.

```bash
git add app tests
git commit -m "feat: show vote totals while voting unless the facilitator hides them"
```

---

### Task 3: Single-emoji rule and card reactions (backend)

**Files:**
- Create: `app/Rules/SingleEmoji.php` (`vendor/bin/sail artisan make:rule SingleEmoji --no-interaction`), `database/migrations/2026_09_30_090100_create_card_reactions_table.php`, `app/Models/CardReaction.php` (`make:model CardReaction --factory --no-interaction`), `database/factories/CardReactionFactory.php`, `app/Actions/Retros/SummarizeReactions.php`, `app/Http/Controllers/Retros/CardReactionsController.php`, `app/Events/Retros/CardReactionsChanged.php`
- Modify: `app/Models/Card.php`, `routes/web.php`, `app/Actions/Retros/BuildBoardSnapshot.php`, `lang/*.json`
- Test: create `tests/Unit/SingleEmojiTest.php`, `tests/Feature/Retros/CardReactionsTest.php`; `tests/Feature/Retros/BoardSnapshotTest.php`

**Interfaces:**
- Consumes: Task 1 `RetroGuard::unlocked`, `RetroGuard::reactionsEnabled`.
- Produces: `SingleEmoji::MaxBytes = 64`; `Card::reactions(): HasMany<CardReaction>`; `SummarizeReactions::handle(Collection<int, CardReaction> $reactions, Retro $retro, ?Participant $viewer): array<int, array{emoji: string, count: int, mine: bool, names: array<int, string>}>` (ordered by count desc, then first use; `names` empty on anonymous retros); routes `retros.cards.reactions.update` (PUT `retros/{retro}/cards/{card}/reactions`), `retros.cards.reactions.destroy` (DELETE same path), body `{emoji}`, response `{cardId, reactions}`; event `card.reactions.changed` payload `{cardId, reactions: [{emoji, count, names}]}`; snapshot `cards[].reactions` (empty for hidden cards).

- [ ] **Step 1: Write the failing tests**

`tests/Unit/SingleEmojiTest.php`:

```php
<?php

use App\Rules\SingleEmoji;
use Illuminate\Support\Facades\Validator;

it('accepts exactly one emoji', function (string $value) {
    expect(Validator::make(['emoji' => $value], ['emoji' => [new SingleEmoji]])->passes())->toBeTrue();
})->with([
    'simple' => '👍',
    'with variation selector' => '❤️',
    'skin tone and zwj' => '👩🏽‍💻',
    'flag' => '🇫🇷',
    'keycap' => '1️⃣',
    'family' => '👨‍👩‍👧‍👦',
]);

it('rejects anything that is not exactly one emoji', function (string $value) {
    $validator = Validator::make(['emoji' => $value], ['emoji' => [new SingleEmoji]]);

    expect($validator->fails())->toBeTrue()
        ->and($validator->errors()->first('emoji'))->toBe('Choose a single emoji.');
})->with([
    'text' => 'ok',
    'two emoji' => '👍👍',
    'emoji and text' => '👍a',
    'oversized' => str_repeat("\u{200D}", 70),
]);
```

(Unit tests do not boot the app by default; if `tests/Pest.php` does not extend `Tests\TestCase` for `Unit`, move this file to `tests/Feature/SingleEmojiTest.php` instead.)

`tests/Feature/Retros/CardReactionsTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Events\Retros\CardReactionsChanged;
use App\Models\Card;
use App\Models\CardReaction;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function reactingRetro(RetroPhase $phase = RetroPhase::Grouping, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create($attributes);
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    return [$retro, $user, $participant, $card];
}

it('adds and removes a reaction idempotently', function () {
    [$retro, $user, $participant, $card] = reactingRetro();
    $route = route('retros.cards.reactions.update', [$retro, $card]);

    $this->actingAs($user)->putJson($route, ['emoji' => '🎉'])->assertOk();
    $this->actingAs($user)->putJson($route, ['emoji' => '🎉'])
        ->assertOk()
        ->assertJson(['cardId' => $card->id, 'reactions' => [['emoji' => '🎉', 'count' => 1, 'mine' => true]]]);

    expect(CardReaction::count())->toBe(1);

    $this->actingAs($user)->deleteJson(route('retros.cards.reactions.destroy', [$retro, $card]), ['emoji' => '🎉'])
        ->assertOk()
        ->assertJsonPath('reactions', []);
    $this->actingAs($user)->deleteJson(route('retros.cards.reactions.destroy', [$retro, $card]), ['emoji' => '🎉'])->assertOk();

    expect(CardReaction::count())->toBe(0);
});

it('summarises reactions by count and broadcasts no participant ids', function () {
    [$retro, $user, $participant, $card] = reactingRetro();
    CardReaction::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'emoji' => '👍']);

    $this->actingAs($user)->putJson(route('retros.cards.reactions.update', [$retro, $card]), ['emoji' => '🤔'])
        ->assertJsonPath('reactions.0.emoji', '👍')
        ->assertJsonPath('reactions.0.count', 2)
        ->assertJsonPath('reactions.0.mine', false)
        ->assertJsonPath('reactions.1.emoji', '🤔')
        ->assertJsonPath('reactions.1.names', [$user->name]);

    Event::assertDispatched(CardReactionsChanged::class, fn (CardReactionsChanged $event) => $event->broadcastAs() === 'card.reactions.changed'
        && $event->broadcastWith()['cardId'] === $card->id
        && ! str_contains(json_encode($event->broadcastWith()), $participant->id)
        && ! array_key_exists('mine', $event->broadcastWith()['reactions'][0]));
});

it('hides who reacted on anonymous retros', function () {
    [$retro, $user, , $card] = reactingRetro(RetroPhase::Grouping, ['is_anonymous' => true]);

    $this->actingAs($user)->putJson(route('retros.cards.reactions.update', [$retro, $card]), ['emoji' => '👍'])
        ->assertJsonPath('reactions.0.names', []);
});

it('refuses reactions before grouping, once completed, when turned off and when locked', function (RetroPhase $phase, array $attributes, int $status) {
    [$retro, $user, , $card] = reactingRetro($phase, $attributes);

    $this->actingAs($user)->putJson(route('retros.cards.reactions.update', [$retro, $card]), ['emoji' => '👍'])->assertStatus($status);
})->with([
    'writing' => [RetroPhase::Writing, [], 403],
    'completed' => [RetroPhase::Completed, [], 403],
    'turned off' => [RetroPhase::Voting, ['reactions_enabled' => false], 403],
    'locked' => [RetroPhase::Discussing, ['is_locked' => true], 423],
]);

it('rejects invalid emoji', function () {
    [$retro, $user, , $card] = reactingRetro();

    $this->actingAs($user)->putJson(route('retros.cards.reactions.update', [$retro, $card]), ['emoji' => 'lol'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['emoji' => 'Choose a single emoji.']);
});

it('returns 404 for cards of another retro', function () {
    [$retro, $user] = reactingRetro();
    $foreign = Card::factory()->create();

    $this->actingAs($user)->putJson(route('retros.cards.reactions.update', [$retro, $foreign]), ['emoji' => '👍'])->assertNotFound();
});
```

Append to `tests/Feature/Retros/BoardSnapshotTest.php` (import `App\Models\CardReaction`):

```php
it('lists reactions on visible cards with the viewer own flag', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [, $viewer] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    CardReaction::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $viewer->id, 'emoji' => '👍']);

    expect(snapshotCard(snapshotFor($retro, $viewer), $card)['reactions'])
        ->toBe([['emoji' => '👍', 'count' => 1, 'mine' => true, 'names' => [$viewer->displayName()]]]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Unit/SingleEmojiTest.php tests/Feature/Retros/CardReactionsTest.php tests/Feature/Retros/BoardSnapshotTest.php`
Expected: FAIL — classes and routes missing.

- [ ] **Step 3: Rule**

`app/Rules/SingleEmoji.php`:

```php
<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class SingleEmoji implements ValidationRule
{
    public const MaxBytes = 64;

    private const Pattern = '/^(?=\X$)(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2}|[0-9#*]\x{FE0F}?\x{20E3})/u';

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            $fail(__('Choose a single emoji.'));

            return;
        }

        if (strlen($value) > self::MaxBytes) {
            $fail(__('Choose a single emoji.'));

            return;
        }

        if (preg_match(self::Pattern, $value) !== 1) {
            $fail(__('Choose a single emoji.'));
        }
    }
}
```

- [ ] **Step 4: Table, model, factory**

Migration (rename to `2026_09_30_090100_create_card_reactions_table.php`):

```php
        Schema::create('card_reactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('card_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('participant_id')->constrained()->cascadeOnDelete();
            $table->string('emoji', 64);
            $table->timestamps();
            $table->unique(['card_id', 'participant_id', 'emoji']);
            $table->index('retro_id');
        });
```

`app/Models/CardReaction.php`:

```php
<?php

namespace App\Models;

use Database\Factories\CardReactionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $retro_id
 * @property string $card_id
 * @property string $participant_id
 * @property string $emoji
 * @property-read Participant $participant
 */
#[Fillable(['retro_id', 'card_id', 'participant_id', 'emoji'])]
class CardReaction extends Model
{
    /** @use HasFactory<CardReactionFactory> */
    use HasFactory;
    use HasUuids;

    /** @return BelongsTo<Card, $this> */
    public function card(): BelongsTo
    {
        return $this->belongsTo(Card::class);
    }

    /** @return BelongsTo<Participant, $this> */
    public function participant(): BelongsTo
    {
        return $this->belongsTo(Participant::class);
    }
}
```

`database/factories/CardReactionFactory.php`:

```php
    public function definition(): array
    {
        return [
            'retro_id' => Retro::factory(),
            'card_id' => fn (array $attributes) => Card::factory()->create(['retro_id' => $attributes['retro_id']])->id,
            'participant_id' => fn (array $attributes) => Participant::factory()->create(['retro_id' => $attributes['retro_id']])->id,
            'emoji' => '👍',
        ];
    }
```

`app/Models/Card.php`:

```php
    /** @return HasMany<CardReaction, $this> */
    public function reactions(): HasMany
    {
        return $this->hasMany(CardReaction::class)->oldest();
    }
```

- [ ] **Step 5: Summary, event, controller, routes**

`app/Actions/Retros/SummarizeReactions.php`:

```php
<?php

namespace App\Actions\Retros;

use App\Models\CardReaction;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Support\Collection;

class SummarizeReactions
{
    /**
     * @param  Collection<int, CardReaction>  $reactions
     * @return array<int, array{
     *     emoji: string,
     *     count: int,
     *     mine: bool,
     *     names: array<int, string>
     * }>
     */
    public function handle(Collection $reactions, Retro $retro, ?Participant $viewer): array
    {
        return $reactions
            ->groupBy('emoji')
            ->map(fn (Collection $group, string $emoji) => [
                'emoji' => $emoji,
                'count' => $group->count(),
                'mine' => $viewer !== null && $group->contains('participant_id', $viewer->id),
                'names' => $retro->is_anonymous
                    ? []
                    : $group->map(fn (CardReaction $reaction) => $reaction->participant->displayName())->values()->all(),
            ])
            ->values()
            ->sortByDesc('count')
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, CardReaction>  $reactions
     * @return array<int, array{
     *     emoji: string,
     *     count: int,
     *     names: array<int, string>
     * }>
     */
    public function forOthers(Collection $reactions, Retro $retro): array
    {
        return array_map(
            fn (array $summary) => ['emoji' => $summary['emoji'], 'count' => $summary['count'], 'names' => $summary['names']],
            $this->handle($reactions, $retro, null),
        );
    }
}
```

(`groupBy` keeps first-use order and PHP's sort is stable, so equal counts stay in first-use order. Reactions come from `Card::reactions()`, which is ordered `oldest()`.)

`app/Events/Retros/CardReactionsChanged.php`:

```php
<?php

namespace App\Events\Retros;

class CardReactionsChanged extends RetroBroadcastEvent
{
    /**
     * @param  array<int, array{emoji: string, count: int, names: array<int, string>}>  $reactions
     */
    public function __construct(string $retroId, public string $cardId, public array $reactions)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'card.reactions.changed';
    }

    public function broadcastWith(): array
    {
        return ['cardId' => $this->cardId, 'reactions' => $this->reactions];
    }
}
```

`app/Http/Controllers/Retros/CardReactionsController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Actions\Retros\SummarizeReactions;
use App\Enums\RetroPhase;
use App\Events\Retros\CardReactionsChanged;
use App\Http\Controllers\Controller;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Rules\SingleEmoji;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CardReactionsController extends Controller
{
    public function __construct(private SummarizeReactions $summarizeReactions) {}

    public function update(Request $request, Retro $retro, Card $card): JsonResponse
    {
        return $this->toggle($request, $retro, $card, adds: true);
    }

    public function destroy(Request $request, Retro $retro, Card $card): JsonResponse
    {
        return $this->toggle($request, $retro, $card, adds: false);
    }

    private function toggle(Request $request, Retro $retro, Card $card, bool $adds): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro);

        $validated = $request->validate([
            'emoji' => ['required', 'string', new SingleEmoji],
        ]);

        [$reactions, $presentingRetro] = DB::transaction(function () use ($retro, $card, $participant, $validated, $adds): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->guard($locked);

            $fresh = $locked->cards()->whereKey($card->id)->firstOrFail();

            if ($adds) {
                $fresh->reactions()->firstOrCreate(
                    ['participant_id' => $participant->id, 'emoji' => $validated['emoji']],
                    ['retro_id' => $locked->id],
                );
            }

            if (! $adds) {
                $fresh->reactions()->where('participant_id', $participant->id)->where('emoji', $validated['emoji'])->delete();
            }

            $reactions = $fresh->reactions()->with('participant.user')->get();

            (new CardReactionsChanged($locked->id, $fresh->id, $this->summarizeReactions->forOthers($reactions, $locked)))->sendToOthers();

            return [$reactions, $locked];
        });

        return response()->json([
            'cardId' => $card->id,
            'reactions' => $this->summarizeReactions->handle($reactions, $presentingRetro, $participant),
        ]);
    }

    private function guard(Retro $retro): void
    {
        RetroGuard::phase($retro, RetroPhase::Grouping, RetroPhase::Voting, RetroPhase::Discussing);
        RetroGuard::unlocked($retro);
        RetroGuard::reactionsEnabled($retro);
    }
}
```

`routes/web.php`, inside the `retros/{retro}` group after the votes routes (import the controller):

```php
        Route::put('cards/{card}/reactions', [CardReactionsController::class, 'update'])->name('retros.cards.reactions.update')->whereUuid('card');
        Route::delete('cards/{card}/reactions', [CardReactionsController::class, 'destroy'])->name('retros.cards.reactions.destroy')->whereUuid('card');
```

- [ ] **Step 6: Snapshot**

`BuildBoardSnapshot`: inject `private SummarizeReactions $summarizeReactions` in the constructor; add `'cards.reactions.participant.user'` to `loadMissing`; in the `cards` map add (the presented card tells whether the card is hidden from this viewer):

```php
            'cards' => $retro->cards->sortBy('position')->map(function (Card $card) use ($retro, $viewer, $showsTotals, $voteTotals, $myVotes) {
                $presented = $this->presentCard->handle($card, $retro, $viewer);
                $isHidden = $presented['content'] === null && ! $presented['isMine'] && $retro->phase === RetroPhase::Writing;

                return [
                    ...$presented,
                    'votes' => $showsTotals ? (int) ($voteTotals[$card->id] ?? 0) : null,
                    'myVotes' => (int) ($myVotes[$card->id] ?? 0),
                    'reactions' => $isHidden ? [] : $this->summarizeReactions->handle($card->reactions, $retro, $viewer),
                ];
            })->values()->all(),
```

(Task 5 replaces `$isHidden` with the presenter's own `hidden` flag.)

- [ ] **Step 7: Translations**

| key | fr | es | de |
|---|---|---|---|
| Choose a single emoji. | Choisissez un seul emoji. | Elige un solo emoji. | Wähle ein einzelnes Emoji. |

- [ ] **Step 8: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan migrate --no-interaction && vendor/bin/sail artisan test --compact tests/Unit/SingleEmojiTest.php tests/Feature/Retros tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 9: Format, analyse, commit**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress` → clean.

```bash
git add app database routes lang tests
git commit -m "feat: react to cards with any single emoji"
```

---

### Task 4: Card comments, one level of replies, own-comment delivery and notifications (backend)

**Files:**
- Create: migration `2026_09_30_090200_create_card_comments_table.php`, `app/Models/CardComment.php` (+ factory `database/factories/CardCommentFactory.php`), `app/Actions/Retros/PresentComment.php`, `app/Http/Controllers/Retros/CardCommentsController.php`, `app/Events/Retros/{CommentCreated,CommentUpdated,CommentDeleted,OwnCommentSaved,CommentNotification}.php`
- Modify: `app/Models/Card.php`, `app/Models/Retro.php`, `app/Actions/Retros/RetroGuard.php`, `routes/web.php`, `app/Actions/Retros/BuildBoardSnapshot.php`, `lang/*.json`
- Test: create `tests/Feature/Retros/CardCommentsTest.php`; `tests/Feature/Retros/BoardSnapshotTest.php`, `tests/Feature/Retros/CardsTest.php`

**Interfaces:**
- Consumes: Task 1 guards.
- Produces: `CardComment` (`parent_comment_id`, nullable `content`, nullable `deleted_at`); `Card::comments()`, `Retro::comments()` (scoped route binding); `RetroGuard::commentAuthor(CardComment $comment, Participant $participant): void`; `PresentComment::handle(CardComment, Retro, ?Participant): array{id, cardId, parentCommentId, isMine, deleted, content, author, createdAt}` and `PresentComment::threads(Collection<int, CardComment>, Retro, ?Participant): array<int, comment & {replies: array<int, comment>}>`; routes `retros.cards.comments.store` (POST `cards/{card}/comments`, body `{content, parentCommentId?}`, 201 `{comment}`), `retros.comments.update` (PATCH `comments/{comment}`, `{content}` → `{comment}`), `retros.comments.destroy` (DELETE `comments/{comment}` → 204); events `comment.created` / `comment.updated` `{comment}`, `comment.deleted` `{cardId, commentId, soft}`, private `own-comment.saved` `{comment}` and `comment.notification` `{cardId, commentId, threadId, excerpt, authorName?}`; snapshot `cards[].commentCount`, `cards[].comments` (threads).

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Retros/CardCommentsTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Events\Retros\CommentCreated;
use App\Events\Retros\CommentDeleted;
use App\Events\Retros\CommentNotification;
use App\Events\Retros\CommentUpdated;
use App\Events\Retros\OwnCommentSaved;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function commentingRetro(RetroPhase $phase = RetroPhase::Grouping, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create($attributes);
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    return [$retro, $user, $participant, $card];
}

it('comments on a card and sends the author their comment on their private channel', function () {
    [$retro, $user, $participant, $card] = commentingRetro();

    $response = $this->actingAs($user)
        ->postJson(route('retros.cards.comments.store', [$retro, $card]), ['content' => ' Agreed '])
        ->assertCreated()
        ->assertJsonPath('comment.content', 'Agreed')
        ->assertJsonPath('comment.isMine', true)
        ->assertJsonPath('comment.author.id', $participant->id);

    Event::assertDispatched(CommentCreated::class, fn (CommentCreated $event) => $event->comment['id'] === $response->json('comment.id')
        && $event->comment['isMine'] === false);
    Event::assertDispatched(OwnCommentSaved::class, fn (OwnCommentSaved $event) => $event->participantId === $participant->id
        && $event->comment['isMine'] === true
        && $event->broadcastOn()->name === "private-participant.{$participant->id}");
});

it('validates comment content', function (string $content) {
    [$retro, $user, , $card] = commentingRetro();

    $this->actingAs($user)->postJson(route('retros.cards.comments.store', [$retro, $card]), ['content' => $content])->assertUnprocessable();
})->with(['empty' => '', 'too long' => str_repeat('a', 501)]);

it('attaches a reply to a reply to the top-level comment', function () {
    [$retro, $user, , $card] = commentingRetro();
    $parent = CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);
    $reply = CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'parent_comment_id' => $parent->id]);

    $this->actingAs($user)
        ->postJson(route('retros.cards.comments.store', [$retro, $card]), ['content' => 'Me too', 'parentCommentId' => $reply->id])
        ->assertCreated()
        ->assertJsonPath('comment.parentCommentId', $parent->id);
});

it('refuses a parent comment from another card', function () {
    [$retro, $user, , $card] = commentingRetro();
    $otherComment = CardComment::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)
        ->postJson(route('retros.cards.comments.store', [$retro, $card]), ['content' => 'x', 'parentCommentId' => $otherComment->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['parentCommentId' => 'The reply must belong to a comment on the same card.']);
});

it('lets only the author edit and the author or facilitator delete', function () {
    [$retro, $user, $participant, $card] = commentingRetro();
    [$other] = retroMember($retro);
    [$facilitator] = retroFacilitator($retro);
    $comment = CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $participant->id]);
    $othersComment = CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $this->actingAs($other)->patchJson(route('retros.comments.update', [$retro, $comment]), ['content' => 'Hijack'])->assertForbidden();
    $this->actingAs($user)->patchJson(route('retros.comments.update', [$retro, $comment]), ['content' => 'Edited'])
        ->assertOk()
        ->assertJsonPath('comment.content', 'Edited');
    Event::assertDispatched(CommentUpdated::class);

    $this->actingAs($other)->deleteJson(route('retros.comments.destroy', [$retro, $comment]))->assertForbidden();
    $this->actingAs($user)->deleteJson(route('retros.comments.destroy', [$retro, $comment]))->assertNoContent();
    $this->actingAs($facilitator)->deleteJson(route('retros.comments.destroy', [$retro, $othersComment]))->assertNoContent();

    expect(CardComment::count())->toBe(0);
    Event::assertDispatched(CommentDeleted::class, fn (CommentDeleted $event) => $event->commentId === $comment->id && $event->soft === false);
});

it('soft deletes a parent with replies and removes it with its last reply', function () {
    [$retro, $user, $participant, $card] = commentingRetro();
    $parent = CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $participant->id]);
    $reply = CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'parent_comment_id' => $parent->id, 'participant_id' => $participant->id]);

    $this->actingAs($user)->deleteJson(route('retros.comments.destroy', [$retro, $parent]))->assertNoContent();

    expect($parent->fresh())->content->toBeNull()->deleted_at->not->toBeNull();
    Event::assertDispatched(CommentDeleted::class, fn (CommentDeleted $event) => $event->commentId === $parent->id && $event->soft === true);

    $this->actingAs($user)->patchJson(route('retros.comments.update', [$retro, $parent]), ['content' => 'Back'])->assertNotFound();

    $this->actingAs($user)->deleteJson(route('retros.comments.destroy', [$retro, $reply]))->assertNoContent();

    expect(CardComment::count())->toBe(0);
    Event::assertDispatched(CommentDeleted::class, fn (CommentDeleted $event) => $event->commentId === $parent->id && $event->soft === false);
});

it('refuses comments before grouping, once completed and while locked', function (RetroPhase $phase, array $attributes, int $status) {
    [$retro, $user, , $card] = commentingRetro($phase, $attributes);

    $this->actingAs($user)->postJson(route('retros.cards.comments.store', [$retro, $card]), ['content' => 'x'])->assertStatus($status);
})->with([
    'writing' => [RetroPhase::Writing, [], 403],
    'completed' => [RetroPhase::Completed, [], 403],
    'locked' => [RetroPhase::Discussing, ['is_locked' => true], 423],
]);

it('hides comment authors from others on anonymous retros', function () {
    [$retro, $user, , $card] = commentingRetro(RetroPhase::Grouping, ['is_anonymous' => true]);

    $this->actingAs($user)->postJson(route('retros.cards.comments.store', [$retro, $card]), ['content' => 'Quiet'])
        ->assertJsonPath('comment.author.name', $user->name);

    Event::assertDispatched(CommentCreated::class, fn (CommentCreated $event) => $event->comment['author'] === null);
});

it('notifies the card author and the thread participants but not the commenter', function () {
    [$retro, $user, $participant, $card] = commentingRetro();
    [, $earlier] = retroMember($retro);
    $thread = CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $earlier->id]);

    $this->actingAs($user)->postJson(route('retros.cards.comments.store', [$retro, $card]), ['content' => 'Replying here', 'parentCommentId' => $thread->id])
        ->assertCreated();

    $recipients = collect(Event::dispatched(CommentNotification::class))->map(fn (array $dispatch) => $dispatch[0]->participantId)->sort()->values()->all();

    expect($recipients)->toBe(collect([$card->participant_id, $earlier->id])->sort()->values()->all());
    Event::assertDispatched(CommentNotification::class, fn (CommentNotification $event) => $event->broadcastWith()['threadId'] === $thread->id
        && $event->broadcastWith()['authorName'] === $user->name
        && $event->broadcastOn()->name === "private-participant.{$event->participantId}");
});

it('notifies without naming anyone on anonymous retros', function () {
    [$retro, $user, , $card] = commentingRetro(RetroPhase::Grouping, ['is_anonymous' => true]);

    $this->actingAs($user)->postJson(route('retros.cards.comments.store', [$retro, $card]), ['content' => 'Hi'])->assertCreated();

    Event::assertDispatched(CommentNotification::class, fn (CommentNotification $event) => ! array_key_exists('authorName', $event->broadcastWith()));
});

it('does not notify the commenter about their own card', function () {
    [$retro, $user, $participant] = commentingRetro();
    $own = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);

    $this->actingAs($user)->postJson(route('retros.cards.comments.store', [$retro, $own]), ['content' => 'Note to self'])->assertCreated();

    Event::assertNotDispatched(CommentNotification::class);
});

it('returns 404 for cards and comments of another retro', function () {
    [$retro, $user] = commentingRetro();
    $foreignCard = Card::factory()->create();
    $foreignComment = CardComment::factory()->create();

    $this->actingAs($user)->postJson(route('retros.cards.comments.store', [$retro, $foreignCard]), ['content' => 'x'])->assertNotFound();
    $this->actingAs($user)->deleteJson(route('retros.comments.destroy', [$retro, $foreignComment]))->assertNotFound();
});
```

Append to `tests/Feature/Retros/CardsTest.php` (import `App\Models\CardComment`, `App\Models\CardReaction`):

```php
it('deletes comments and reactions with their card', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);
    CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);
    CardReaction::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $this->actingAs($user)->deleteJson(route('retros.cards.destroy', [$retro, $card]))->assertNoContent();

    expect(CardComment::count())->toBe(0)->and(CardReaction::count())->toBe(0);
});
```

Append to `tests/Feature/Retros/BoardSnapshotTest.php` (import `App\Models\CardComment`):

```php
it('lists comment threads with replies and counts visible comments', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [, $viewer] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    $thread = CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $viewer->id, 'created_at' => now()->subMinutes(3)]);
    CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'parent_comment_id' => $thread->id, 'created_at' => now()->subMinutes(2)]);
    CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'content' => null, 'deleted_at' => now(), 'created_at' => now()->subMinute()]);

    $presented = snapshotCard(snapshotFor($retro, $viewer), $card);

    expect($presented['commentCount'])->toBe(2)
        ->and($presented['comments'][0]['id'])->toBe($thread->id)
        ->and($presented['comments'][0]['isMine'])->toBeTrue()
        ->and($presented['comments'][0]['replies'])->toHaveCount(1)
        ->and($presented['comments'][1])->toMatchArray(['deleted' => true, 'content' => null, 'author' => null]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/CardCommentsTest.php tests/Feature/Retros/CardsTest.php tests/Feature/Retros/BoardSnapshotTest.php`
Expected: FAIL — classes and routes missing.

- [ ] **Step 3: Table, model, factory, relations**

Migration (rename to `2026_09_30_090200_create_card_comments_table.php`):

```php
        Schema::create('card_comments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('card_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('participant_id')->constrained()->cascadeOnDelete();
            $table->uuid('parent_comment_id')->nullable();
            $table->text('content')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();
            $table->index(['card_id', 'created_at']);
            $table->index('retro_id');
        });

        Schema::table('card_comments', function (Blueprint $table) {
            $table->foreign('parent_comment_id')->references('id')->on('card_comments')->cascadeOnDelete();
        });
```

`app/Models/CardComment.php` (`deleted_at` is managed by hand — do **not** use `SoftDeletes`, soft-deleted parents must stay visible):

```php
<?php

namespace App\Models;

use Database\Factories\CardCommentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $retro_id
 * @property string $card_id
 * @property string $participant_id
 * @property string|null $parent_comment_id
 * @property string|null $content
 * @property Carbon|null $deleted_at
 * @property Carbon $created_at
 * @property-read Participant $participant
 * @property-read Card $card
 */
#[Fillable(['retro_id', 'card_id', 'participant_id', 'parent_comment_id', 'content', 'deleted_at'])]
class CardComment extends Model
{
    /** @use HasFactory<CardCommentFactory> */
    use HasFactory;
    use HasUuids;

    /** @return BelongsTo<Card, $this> */
    public function card(): BelongsTo
    {
        return $this->belongsTo(Card::class);
    }

    /** @return BelongsTo<Participant, $this> */
    public function participant(): BelongsTo
    {
        return $this->belongsTo(Participant::class);
    }

    /** @return HasMany<CardComment, $this> */
    public function replies(): HasMany
    {
        return $this->hasMany(CardComment::class, 'parent_comment_id')->oldest();
    }

    public function isDeleted(): bool
    {
        return $this->deleted_at !== null;
    }

    public function threadId(): string
    {
        return $this->parent_comment_id ?? $this->id;
    }

    protected function casts(): array
    {
        return ['deleted_at' => 'datetime'];
    }
}
```

`database/factories/CardCommentFactory.php`:

```php
    public function definition(): array
    {
        return [
            'retro_id' => Retro::factory(),
            'card_id' => fn (array $attributes) => Card::factory()->create(['retro_id' => $attributes['retro_id']])->id,
            'participant_id' => fn (array $attributes) => Participant::factory()->create(['retro_id' => $attributes['retro_id']])->id,
            'content' => fake()->sentence(),
        ];
    }
```

`Card.php`:

```php
    /** @return HasMany<CardComment, $this> */
    public function comments(): HasMany
    {
        return $this->hasMany(CardComment::class)->oldest();
    }
```

`Retro.php` (name must be `comments` — the `{comment}` route parameter is resolved through it by `scopeBindings()`):

```php
    /** @return HasMany<CardComment, $this> */
    public function comments(): HasMany
    {
        return $this->hasMany(CardComment::class);
    }
```

`RetroGuard.php`:

```php
    public static function commentAuthor(CardComment $comment, Participant $participant): void
    {
        if ($comment->participant_id === $participant->id) {
            return;
        }

        throw new AuthorizationException(__('You can only change your own comments.'));
    }
```

- [ ] **Step 4: Presenter**

`app/Actions/Retros/PresentComment.php`:

```php
<?php

namespace App\Actions\Retros;

use App\Models\CardComment;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Support\Collection;

class PresentComment
{
    /**
     * @return array{
     *     id: string,
     *     cardId: string,
     *     parentCommentId: ?string,
     *     isMine: bool,
     *     deleted: bool,
     *     content: ?string,
     *     author: ?array{id: string, name: string},
     *     createdAt: string
     * }
     */
    public function handle(CardComment $comment, Retro $retro, ?Participant $viewer): array
    {
        $isMine = $viewer !== null && $comment->participant_id === $viewer->id;
        $showsAuthor = ! $comment->isDeleted() && ($isMine || ! $retro->is_anonymous);

        return [
            'id' => $comment->id,
            'cardId' => $comment->card_id,
            'parentCommentId' => $comment->parent_comment_id,
            'isMine' => $isMine,
            'deleted' => $comment->isDeleted(),
            'content' => $comment->isDeleted() ? null : $comment->content,
            'author' => $showsAuthor
                ? ['id' => $comment->participant_id, 'name' => $comment->participant->displayName()]
                : null,
            'createdAt' => $comment->created_at->toIso8601String(),
        ];
    }

    /**
     * @param  Collection<int, CardComment>  $comments  every comment of one card, oldest first
     * @return array<int, array<string, mixed>>
     */
    public function threads(Collection $comments, Retro $retro, ?Participant $viewer): array
    {
        $repliesByParent = $comments->whereNotNull('parent_comment_id')->groupBy('parent_comment_id');

        return $comments
            ->whereNull('parent_comment_id')
            ->map(fn (CardComment $comment) => [
                ...$this->handle($comment, $retro, $viewer),
                'replies' => $repliesByParent->get($comment->id, collect())
                    ->map(fn (CardComment $reply) => $this->handle($reply, $retro, $viewer))
                    ->values()
                    ->all(),
            ])
            ->values()
            ->all();
    }
}
```

- [ ] **Step 5: Events**

`CommentCreated` / `CommentUpdated` (same shape, names `comment.created` / `comment.updated`):

```php
<?php

namespace App\Events\Retros;

class CommentCreated extends RetroBroadcastEvent
{
    /**
     * @param  array<string, mixed>  $comment
     */
    public function __construct(string $retroId, public array $comment)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'comment.created';
    }

    public function broadcastWith(): array
    {
        return ['comment' => $this->comment];
    }
}
```

`CommentDeleted`:

```php
class CommentDeleted extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public string $cardId, public string $commentId, public bool $soft)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'comment.deleted';
    }

    public function broadcastWith(): array
    {
        return ['cardId' => $this->cardId, 'commentId' => $this->commentId, 'soft' => $this->soft];
    }
}
```

`OwnCommentSaved` — same as `OwnCardSaved` with `public array $comment`, `broadcastAs()` `'own-comment.saved'`, `broadcastWith()` `['comment' => $this->comment]`, on `new PrivateChannel("participant.{$this->participantId}")`.

`CommentNotification`:

```php
<?php

namespace App\Events\Retros;

use Illuminate\Broadcasting\PrivateChannel;

class CommentNotification extends RetroBroadcastEvent
{
    /**
     * @param  array{cardId: string, commentId: string, threadId: string, excerpt: string, authorName?: string}  $notification
     */
    public function __construct(string $retroId, public string $participantId, public array $notification)
    {
        parent::__construct($retroId);
    }

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("participant.{$this->participantId}");
    }

    public function broadcastAs(): string
    {
        return 'comment.notification';
    }

    public function broadcastWith(): array
    {
        return $this->notification;
    }
}
```

- [ ] **Step 6: Controller and routes**

`app/Http/Controllers/Retros/CardCommentsController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\PresentComment;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\CommentCreated;
use App\Events\Retros\CommentDeleted;
use App\Events\Retros\CommentNotification;
use App\Events\Retros\CommentUpdated;
use App\Events\Retros\OwnCommentSaved;
use App\Http\Controllers\Controller;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CardCommentsController extends Controller
{
    public function __construct(private PresentComment $presentComment) {}

    public function store(Request $request, Retro $retro, Card $card): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro);

        $validated = $request->validate([
            'content' => ['required', 'string', 'max:500'],
            'parentCommentId' => ['nullable', 'uuid'],
        ]);

        [$comment, $presentingRetro] = DB::transaction(function () use ($retro, $card, $participant, $validated): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->guard($locked);

            $fresh = $locked->cards()->whereKey($card->id)->firstOrFail();
            $parentId = $this->threadIdFor($fresh, $validated['parentCommentId'] ?? null);

            $comment = $fresh->comments()->create([
                'retro_id' => $locked->id,
                'participant_id' => $participant->id,
                'parent_comment_id' => $parentId,
                'content' => $validated['content'],
            ]);

            $comment->load('participant.user');

            (new CommentCreated($locked->id, $this->presentComment->handle($comment, $locked, null)))->sendToOthers();
            (new OwnCommentSaved($locked->id, $participant->id, $this->presentComment->handle($comment, $locked, $participant)))->sendToOthers();

            $this->notify($locked, $fresh, $comment, $participant);

            return [$comment, $locked];
        });

        return response()->json(['comment' => $this->presentComment->handle($comment, $presentingRetro, $participant)], 201);
    }

    public function update(Request $request, Retro $retro, CardComment $comment): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro);
        abort_if($comment->isDeleted(), 404);
        RetroGuard::commentAuthor($comment, $participant);

        $validated = $request->validate([
            'content' => ['required', 'string', 'max:500'],
        ]);

        [$fresh, $presentingRetro] = DB::transaction(function () use ($retro, $comment, $participant, $validated): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->guard($locked);

            $fresh = $locked->comments()->whereKey($comment->id)->firstOrFail();

            abort_if($fresh->isDeleted(), 404);
            RetroGuard::commentAuthor($fresh, $participant);

            $fresh->update(['content' => $validated['content']]);
            $fresh->load('participant.user');

            (new CommentUpdated($locked->id, $this->presentComment->handle($fresh, $locked, null)))->sendToOthers();
            (new OwnCommentSaved($locked->id, $participant->id, $this->presentComment->handle($fresh, $locked, $participant)))->sendToOthers();

            return [$fresh, $locked];
        });

        return response()->json(['comment' => $this->presentComment->handle($fresh, $presentingRetro, $participant)]);
    }

    public function destroy(Request $request, Retro $retro, CardComment $comment): Response
    {
        $participant = Participant::current($request);

        $this->guard($retro);
        $this->guardDeletion($retro, $comment, $participant);

        DB::transaction(function () use ($retro, $comment, $participant): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            $this->guard($locked);

            $fresh = $locked->comments()->whereKey($comment->id)->firstOrFail();

            $this->guardDeletion($locked, $fresh, $participant);

            if ($fresh->parent_comment_id === null && $fresh->replies()->exists()) {
                $fresh->update(['content' => null, 'deleted_at' => now()]);

                (new CommentDeleted($locked->id, $fresh->card_id, $fresh->id, soft: true))->sendToOthers();

                return;
            }

            $fresh->delete();

            (new CommentDeleted($locked->id, $fresh->card_id, $fresh->id, soft: false))->sendToOthers();

            $parent = $fresh->parent_comment_id === null ? null : $locked->comments()->whereKey($fresh->parent_comment_id)->first();

            if ($parent === null || ! $parent->isDeleted() || $parent->replies()->exists()) {
                return;
            }

            $parent->delete();

            (new CommentDeleted($locked->id, $parent->card_id, $parent->id, soft: false))->sendToOthers();
        });

        return response()->noContent();
    }

    private function guard(Retro $retro): void
    {
        RetroGuard::phase($retro, RetroPhase::Grouping, RetroPhase::Voting, RetroPhase::Discussing);
        RetroGuard::unlocked($retro);
    }

    private function guardDeletion(Retro $retro, CardComment $comment, Participant $participant): void
    {
        abort_if($comment->isDeleted(), 404);

        if ($retro->isFacilitator($participant)) {
            return;
        }

        RetroGuard::commentAuthor($comment, $participant);
    }

    private function threadIdFor(Card $card, ?string $parentCommentId): ?string
    {
        if ($parentCommentId === null) {
            return null;
        }

        $parent = $card->comments()->whereKey($parentCommentId)->first();

        if ($parent === null) {
            throw ValidationException::withMessages(['parentCommentId' => __('The reply must belong to a comment on the same card.')]);
        }

        return $parent->threadId();
    }

    private function notify(Retro $retro, Card $card, CardComment $comment, Participant $commenter): void
    {
        $threadParticipantIds = $comment->parent_comment_id === null
            ? collect()
            : $card->comments()
                ->where(fn ($query) => $query->whereKey($comment->parent_comment_id)->orWhere('parent_comment_id', $comment->parent_comment_id))
                ->pluck('participant_id');

        $recipients = $threadParticipantIds
            ->push($card->participant_id)
            ->unique()
            ->reject(fn (string $participantId) => $participantId === $commenter->id);

        $notification = [
            'cardId' => $card->id,
            'commentId' => $comment->id,
            'threadId' => $comment->threadId(),
            'excerpt' => Str::limit((string) $comment->content, 80),
            ...($retro->is_anonymous ? [] : ['authorName' => $commenter->displayName()]),
        ];

        foreach ($recipients as $participantId) {
            (new CommentNotification($retro->id, $participantId, $notification))->sendToOthers();
        }
    }
}
```

`routes/web.php` (import `CardCommentsController`):

```php
        Route::post('cards/{card}/comments', [CardCommentsController::class, 'store'])->name('retros.cards.comments.store')->whereUuid('card');
        Route::patch('comments/{comment}', [CardCommentsController::class, 'update'])->name('retros.comments.update')->whereUuid('comment');
        Route::delete('comments/{comment}', [CardCommentsController::class, 'destroy'])->name('retros.comments.destroy')->whereUuid('comment');
```

(The `content` string is trimmed and empty strings become null by Laravel's default middleware, so `' Agreed '` is stored as `Agreed` and `''` fails `required`.)

- [ ] **Step 7: Snapshot**

`BuildBoardSnapshot`: inject `private PresentComment $presentComment`; add `'cards.comments.participant.user'` to `loadMissing`; in the card map add:

```php
                    'commentCount' => $isHidden ? 0 : $card->comments->reject(fn (CardComment $comment) => $comment->isDeleted())->count(),
                    'comments' => $isHidden ? [] : $this->presentComment->threads($card->comments, $retro, $viewer),
```

(import `App\Models\CardComment`).

- [ ] **Step 8: Translations**

| key | fr | es | de |
|---|---|---|---|
| You can only change your own comments. | Vous ne pouvez modifier que vos propres commentaires. | Solo puedes cambiar tus propios comentarios. | Du kannst nur deine eigenen Kommentare ändern. |
| The reply must belong to a comment on the same card. | La réponse doit concerner un commentaire de la même carte. | La respuesta debe corresponder a un comentario de la misma tarjeta. | Die Antwort muss zu einem Kommentar derselben Karte gehören. |

- [ ] **Step 9: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan migrate --no-interaction && vendor/bin/sail artisan test --compact tests/Feature/Retros tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 10: Format, analyse, commit**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress` → clean.

```bash
git add app database routes lang tests
git commit -m "feat: discuss cards in threaded comments with live notifications"
```

---

### Task 5: GIFs in cards (provider, search, proxy, card attachment) and snapshot redaction

**Files:**
- Modify: `config/services.php`, `.env.example`, `app/Providers/AppServiceProvider.php`, `routes/web.php`, `app/Models/Card.php`, `app/Actions/Retros/PresentCard.php`, `app/Actions/Retros/BuildBoardSnapshot.php`, `app/Actions/Retros/RetroGuard.php`, `app/Http/Controllers/Retros/CardsController.php`, `lang/*.json`
- Create: `app/Support/Gifs/Gif.php`, `app/Support/Gifs/GifProvider.php`, `app/Support/Gifs/GiphyProvider.php`, `app/Support/Gifs/TenorProvider.php`, `app/Support/Gifs/GifCatalog.php`, `app/Http/Controllers/Retros/RetroGifsController.php`, `app/Http/Controllers/GifsController.php`, migration `2026_09_30_090300_add_gif_to_cards_table.php`
- Test: create `tests/Feature/Retros/GifsTest.php`; `tests/Feature/Retros/CardsTest.php`, `tests/Feature/Retros/BoardSnapshotTest.php`

**Interfaces:**
- Consumes: Task 1 `gifs_enabled`, `RetroGuard::unlocked`; Tasks 3–4 snapshot fields.
- Produces: `config('services.gifs')` = `provider` (`giphy`|`tenor`|null), `key`, `rating`; `Gif` value object (`id`, `previewUrl`, `fullUrl`, `width`, `height`, `toArray()`, `fromArray()`); `GifCatalog::providerName(): ?string`, `isAvailable(): bool`, `search(string $query): array<int, Gif>`, `resolve(string $id): ?Gif`, `servable(string $id): ?Gif`; `RetroGuard::gifsEnabled(Retro $retro, GifCatalog $gifCatalog): void` (403); route `retros.gifs.index` (GET `retros/{retro}/gifs?q=`, throttle `gif-search`, `{gifs: [{id, previewUrl, width, height}]}`); route `gifs.show` (GET `gifs/{gif}/{size}`, `size` = `preview`|`full`); `cards.gif_id`, nullable `cards.content`; card payload gains `hidden: bool` and `gif: ?{id, previewUrl, url}`; snapshot `retro.gifProvider` (`giphy`|`tenor`|null); card store/update accept `gif_id` (nullable).

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Retros/GifsTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\Column;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Event::fake();
    Storage::fake();
    config(['services.gifs' => ['provider' => 'giphy', 'key' => 'secret-key', 'rating' => 'pg']]);
});

function giphyItem(string $id): array
{
    return [
        'id' => $id,
        'images' => [
            'fixed_width' => ['url' => "https://media.giphy.com/{$id}/200w.gif", 'webp' => "https://media.giphy.com/{$id}/200w.webp", 'width' => '200', 'height' => '150'],
            'original' => ['url' => "https://media.giphy.com/{$id}/giphy.gif", 'webp' => "https://media.giphy.com/{$id}/giphy.webp", 'width' => '480', 'height' => '360'],
        ],
    ];
}

it('searches gifs through the server without exposing the provider', function () {
    Http::fake(['api.giphy.com/v1/gifs/search*' => Http::response(['data' => [giphyItem('abc123')]])]);
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    $response = $this->actingAs($user)
        ->getJson(route('retros.gifs.index', ['retro' => $retro, 'q' => 'party']))
        ->assertOk()
        ->assertJsonPath('gifs.0.id', 'abc123')
        ->assertJsonPath('gifs.0.previewUrl', route('gifs.show', ['gif' => 'abc123', 'size' => 'preview'], false));

    expect($response->getContent())->not->toContain('secret-key')->not->toContain('giphy.com');

    $this->actingAs($user)->getJson(route('retros.gifs.index', ['retro' => $retro, 'q' => 'party']))->assertOk();

    Http::assertSentCount(1);
});

it('returns trending gifs for an empty query', function () {
    Http::fake(['api.giphy.com/v1/gifs/trending*' => Http::response(['data' => [giphyItem('hot1')]])]);
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)->getJson(route('retros.gifs.index', $retro))->assertOk()->assertJsonPath('gifs.0.id', 'hot1');
});

it('hides gif search without a provider and refuses it when not editable', function (?string $provider, RetroPhase $phase, array $attributes, int $status) {
    config(['services.gifs.provider' => $provider]);
    $retro = Retro::factory()->inPhase($phase)->create($attributes);
    [$user] = retroMember($retro);

    $this->actingAs($user)->getJson(route('retros.gifs.index', $retro))->assertStatus($status);
})->with([
    'no provider' => [null, RetroPhase::Writing, [], 404],
    'voting' => ['giphy', RetroPhase::Voting, [], 403],
    'turned off' => ['giphy', RetroPhase::Writing, ['gifs_enabled' => false], 403],
    'locked' => ['giphy', RetroPhase::Grouping, ['is_locked' => true], 423],
]);

it('rate limits gif searches per participant', function () {
    Http::fake(['api.giphy.com/*' => Http::response(['data' => []])]);
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    foreach (range(1, 20) as $attempt) {
        $this->actingAs($user)->getJson(route('retros.gifs.index', ['retro' => $retro, 'q' => "q{$attempt}"]))->assertOk();
    }

    $this->actingAs($user)->getJson(route('retros.gifs.index', ['retro' => $retro, 'q' => 'one more']))->assertTooManyRequests();
});

it('answers 502 when the provider is down', function () {
    Http::fake(['api.giphy.com/*' => Http::response('down', 500)]);
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)->getJson(route('retros.gifs.index', ['retro' => $retro, 'q' => 'x']))
        ->assertStatus(502)
        ->assertJsonPath('message', 'GIF search is unavailable.');
});

it('streams known gifs from a local cache and refuses unknown ones', function () {
    Http::fake([
        'api.giphy.com/v1/gifs/search*' => Http::response(['data' => [giphyItem('abc123')]]),
        'api.giphy.com/v1/gifs/zzz*' => Http::response(['data' => []], 404),
        'media.giphy.com/*' => Http::response("GIF89a\x01\x00\x01\x00", 200, ['Content-Type' => 'image/webp']),
    ]);
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    $this->actingAs($user)->getJson(route('retros.gifs.index', ['retro' => $retro, 'q' => 'party']))->assertOk();

    $this->get(route('gifs.show', ['gif' => 'abc123', 'size' => 'preview']))
        ->assertOk()
        ->assertHeader('Cache-Control', 'immutable, max-age=31536000, public');
    $this->get(route('gifs.show', ['gif' => 'abc123', 'size' => 'preview']))->assertOk();

    Http::assertSentCount(2);

    $this->get(route('gifs.show', ['gif' => 'zzz', 'size' => 'full']))->assertNotFound();
});

it('attaches a gif to a card and keeps text optional', function () {
    Http::fake(['api.giphy.com/v1/gifs/abc123*' => Http::response(['data' => giphyItem('abc123')])]);
    $retro = Retro::factory()->create();
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('retros.cards.store', $retro), ['column_id' => $column->id, 'gif_id' => 'abc123'])
        ->assertCreated()
        ->assertJsonPath('card.content', null)
        ->assertJsonPath('card.hidden', false)
        ->assertJsonPath('card.gif.id', 'abc123')
        ->assertJsonPath('card.gif.url', route('gifs.show', ['gif' => 'abc123', 'size' => 'full'], false));

    $this->actingAs($user)
        ->postJson(route('retros.cards.store', $retro), ['column_id' => $column->id])
        ->assertUnprocessable();
});

it('refuses unknown gifs and gifs when turned off', function () {
    Http::fake(['api.giphy.com/*' => Http::response(['data' => []], 404)]);
    $retro = Retro::factory()->create();
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('retros.cards.store', $retro), ['column_id' => $column->id, 'gif_id' => 'nope'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['gif_id' => 'This GIF could not be found.']);

    $retro->update(['gifs_enabled' => false]);

    $this->actingAs($user)
        ->postJson(route('retros.cards.store', $retro), ['column_id' => $column->id, 'gif_id' => 'nope'])
        ->assertForbidden();
});

it('removes a gif but keeps a card with text or a gif', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'content' => null, 'gif_id' => 'abc123']);

    $this->actingAs($user)->patchJson(route('retros.cards.update', [$retro, $card]), ['gif_id' => null])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['content' => 'A card needs text or a GIF.']);

    $this->actingAs($user)->patchJson(route('retros.cards.update', [$retro, $card]), ['gif_id' => null, 'content' => 'Words'])
        ->assertOk()
        ->assertJsonPath('card.gif', null);
});
```

Append to `tests/Feature/Retros/BoardSnapshotTest.php` (imports `App\Models\CardComment`, `App\Models\CardReaction` already added):

```php
it('hides gifs, reactions and comments of others when the facilitator steps back to writing', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [, $viewer] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'gif_id' => 'abc123']);
    CardReaction::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);
    CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $retro->update(['phase' => RetroPhase::Writing]);

    expect(snapshotCard(snapshotFor($retro, $viewer), $card))->toMatchArray([
        'hidden' => true,
        'content' => null,
        'gif' => null,
        'reactions' => [],
        'commentCount' => 0,
        'comments' => [],
    ]);
});

it('loads reactions and comments with a constant number of queries', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [, $viewer] = retroMember($retro);

    $seed = function (int $cards) use ($retro): void {
        Card::factory()->count($cards)->create(['retro_id' => $retro->id])->each(function (Card $card) use ($retro): void {
            CardReaction::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $card->id]);
            $thread = CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);
            CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'parent_comment_id' => $thread->id]);
        });
    };

    $countQueries = function () use ($retro, $viewer): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        snapshotFor($retro, $viewer);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $seed(2);
    $small = $countQueries();

    $seed(6);

    expect($countQueries())->toBe($small);
});
```

(Add `use Illuminate\Support\Facades\DB;` to the snapshot test file.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/GifsTest.php tests/Feature/Retros/BoardSnapshotTest.php`
Expected: FAIL — routes, columns and payload fields missing.

- [ ] **Step 3: Configuration**

`config/services.php`:

```php
    'gifs' => [
        'provider' => env('SKRUM_GIF_PROVIDER'),
        'key' => env('SKRUM_GIF_API_KEY'),
        'rating' => env('SKRUM_GIF_RATING', 'pg'),
    ],
```

`.env.example`, after `SKRUM_AVATAR_STYLE=thumbs`:

```dotenv

# GIFs in cards: giphy or tenor, with your own API key. Leave empty to hide GIFs.
# Searches and images go through Skrum, so browsers never contact the provider.
SKRUM_GIF_PROVIDER=
SKRUM_GIF_API_KEY=
# g, pg, pg-13 or r
SKRUM_GIF_RATING=pg
```

- [ ] **Step 4: Providers and catalog**

`app/Support/Gifs/Gif.php`:

```php
<?php

namespace App\Support\Gifs;

class Gif
{
    public function __construct(
        public string $id,
        public string $previewUrl,
        public string $fullUrl,
        public int $width,
        public int $height,
    ) {}

    /**
     * @param  array{id: string, previewUrl: string, fullUrl: string, width: int, height: int}  $data
     */
    public static function fromArray(array $data): self
    {
        return new self($data['id'], $data['previewUrl'], $data['fullUrl'], $data['width'], $data['height']);
    }

    /**
     * @return array{id: string, previewUrl: string, fullUrl: string, width: int, height: int}
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'previewUrl' => $this->previewUrl,
            'fullUrl' => $this->fullUrl,
            'width' => $this->width,
            'height' => $this->height,
        ];
    }
}
```

`app/Support/Gifs/GifProvider.php`:

```php
<?php

namespace App\Support\Gifs;

interface GifProvider
{
    /** @return array<int, Gif> */
    public function search(string $query, string $rating, int $limit): array;

    /** @return array<int, Gif> */
    public function trending(string $rating, int $limit): array;

    public function find(string $id): ?Gif;
}
```

`app/Support/Gifs/GiphyProvider.php`:

```php
<?php

namespace App\Support\Gifs;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

class GiphyProvider implements GifProvider
{
    public function __construct(private string $key) {}

    public function search(string $query, string $rating, int $limit): array
    {
        return $this->list('search', ['q' => $query, 'rating' => $rating, 'limit' => $limit]);
    }

    public function trending(string $rating, int $limit): array
    {
        return $this->list('trending', ['rating' => $rating, 'limit' => $limit]);
    }

    public function find(string $id): ?Gif
    {
        $response = $this->client()->get(rawurlencode($id), ['api_key' => $this->key]);

        if ($response->notFound()) {
            return null;
        }

        $item = $response->throw()->json('data');

        return is_array($item) ? $this->toGif($item) : null;
    }

    /**
     * @param  array<string, string|int>  $query
     * @return array<int, Gif>
     */
    private function list(string $endpoint, array $query): array
    {
        $items = $this->client()->get($endpoint, [...$query, 'api_key' => $this->key])->throw()->json('data', []);

        return collect(is_array($items) ? $items : [])
            ->map(fn (mixed $item) => is_array($item) ? $this->toGif($item) : null)
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private function toGif(array $item): ?Gif
    {
        $preview = data_get($item, 'images.fixed_width.webp') ?? data_get($item, 'images.fixed_width.url');
        $full = data_get($item, 'images.original.webp') ?? data_get($item, 'images.original.url');

        if (! is_string($preview) || ! is_string($full) || ! isset($item['id'])) {
            return null;
        }

        return new Gif(
            (string) $item['id'],
            $preview,
            $full,
            (int) data_get($item, 'images.fixed_width.width', 200),
            (int) data_get($item, 'images.fixed_width.height', 200),
        );
    }

    private function client(): PendingRequest
    {
        return Http::baseUrl('https://api.giphy.com/v1/gifs/')->timeout(5)->acceptJson();
    }
}
```

`app/Support/Gifs/TenorProvider.php`:

```php
<?php

namespace App\Support\Gifs;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

class TenorProvider implements GifProvider
{
    private const ContentFilters = ['g' => 'high', 'pg' => 'medium', 'pg-13' => 'low', 'r' => 'off'];

    public function __construct(private string $key) {}

    public function search(string $query, string $rating, int $limit): array
    {
        return $this->list('search', ['q' => $query, 'limit' => $limit, 'contentfilter' => $this->contentFilter($rating)]);
    }

    public function trending(string $rating, int $limit): array
    {
        return $this->list('featured', ['limit' => $limit, 'contentfilter' => $this->contentFilter($rating)]);
    }

    public function find(string $id): ?Gif
    {
        return $this->list('posts', ['ids' => $id])[0] ?? null;
    }

    /**
     * @param  array<string, string|int>  $query
     * @return array<int, Gif>
     */
    private function list(string $endpoint, array $query): array
    {
        $items = $this->client()
            ->get($endpoint, [...$query, 'key' => $this->key, 'media_filter' => 'gif,tinygif'])
            ->throw()
            ->json('results', []);

        return collect(is_array($items) ? $items : [])
            ->map(fn (mixed $item) => is_array($item) ? $this->toGif($item) : null)
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private function toGif(array $item): ?Gif
    {
        $preview = data_get($item, 'media_formats.tinygif.url');
        $full = data_get($item, 'media_formats.gif.url');

        if (! is_string($preview) || ! is_string($full) || ! isset($item['id'])) {
            return null;
        }

        return new Gif(
            (string) $item['id'],
            $preview,
            $full,
            (int) data_get($item, 'media_formats.tinygif.dims.0', 200),
            (int) data_get($item, 'media_formats.tinygif.dims.1', 200),
        );
    }

    private function contentFilter(string $rating): string
    {
        return self::ContentFilters[$rating] ?? 'medium';
    }

    private function client(): PendingRequest
    {
        return Http::baseUrl('https://tenor.googleapis.com/v2/')->timeout(5)->acceptJson();
    }
}
```

`app/Support/Gifs/GifCatalog.php` (stateless: resolves the provider from config on every call — Octane-safe):

```php
<?php

namespace App\Support\Gifs;

use App\Models\Card;
use Illuminate\Support\Facades\Cache;

class GifCatalog
{
    private const SearchTtlSeconds = 600;

    private const ItemTtlSeconds = 86400;

    private const ResultLimit = 24;

    public function provider(): ?GifProvider
    {
        $key = config('services.gifs.key');

        if (! is_string($key) || $key === '') {
            return null;
        }

        return match (config('services.gifs.provider')) {
            'giphy' => new GiphyProvider($key),
            'tenor' => new TenorProvider($key),
            default => null,
        };
    }

    public function providerName(): ?string
    {
        if ($this->provider() === null) {
            return null;
        }

        return (string) config('services.gifs.provider');
    }

    public function isAvailable(): bool
    {
        return $this->provider() !== null;
    }

    /**
     * @return array<int, Gif>
     */
    public function search(string $query): array
    {
        $provider = $this->provider();

        if ($provider === null) {
            return [];
        }

        $query = trim($query);
        $rating = (string) config('services.gifs.rating', 'pg');
        $cacheKey = "gifs:search:{$this->providerName()}:{$rating}:".md5(mb_strtolower($query));

        /** @var array<int, array{id: string, previewUrl: string, fullUrl: string, width: int, height: int}> $items */
        $items = Cache::remember($cacheKey, self::SearchTtlSeconds, fn (): array => array_map(
            fn (Gif $gif) => $gif->toArray(),
            $query === ''
                ? $provider->trending($rating, self::ResultLimit)
                : $provider->search($query, $rating, self::ResultLimit),
        ));

        return array_map(function (array $item): Gif {
            $gif = Gif::fromArray($item);

            $this->remember($gif);

            return $gif;
        }, $items);
    }

    public function resolve(string $id): ?Gif
    {
        $cached = $this->cached($id);

        if ($cached !== null) {
            return $cached;
        }

        $gif = $this->provider()?->find($id);

        if ($gif !== null) {
            $this->remember($gif);
        }

        return $gif;
    }

    /**
     * Only GIFs someone searched for recently or that a card uses may be
     * streamed, so the proxy cannot be used to fetch arbitrary provider content.
     */
    public function servable(string $id): ?Gif
    {
        $cached = $this->cached($id);

        if ($cached !== null) {
            return $cached;
        }

        if (! Card::query()->where('gif_id', $id)->exists()) {
            return null;
        }

        return $this->resolve($id);
    }

    private function cached(string $id): ?Gif
    {
        /** @var array{id: string, previewUrl: string, fullUrl: string, width: int, height: int}|null $item */
        $item = Cache::get($this->itemKey($id));

        return $item === null ? null : Gif::fromArray($item);
    }

    private function remember(Gif $gif): void
    {
        Cache::put($this->itemKey($gif->id), $gif->toArray(), self::ItemTtlSeconds);
    }

    private function itemKey(string $id): string
    {
        return "gifs:item:{$this->providerName()}:{$id}";
    }
}
```

- [ ] **Step 5: Search and proxy controllers, rate limiter, routes**

`app/Actions/Retros/RetroGuard.php` (import `App\Support\Gifs\GifCatalog`):

```php
    public static function gifsEnabled(Retro $retro, GifCatalog $gifCatalog): void
    {
        if ($retro->gifs_enabled && $gifCatalog->isAvailable()) {
            return;
        }

        throw new AuthorizationException(__('GIFs are turned off for this board.'));
    }
```

`app/Http/Controllers/Retros/RetroGifsController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Http\Controllers\Controller;
use App\Models\Retro;
use App\Support\Gifs\Gif;
use App\Support\Gifs\GifCatalog;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RetroGifsController extends Controller
{
    public function index(Request $request, Retro $retro, GifCatalog $gifCatalog): JsonResponse
    {
        abort_unless($gifCatalog->isAvailable(), 404);

        RetroGuard::phase($retro, RetroPhase::Writing, RetroPhase::Grouping);
        RetroGuard::unlocked($retro);
        RetroGuard::gifsEnabled($retro, $gifCatalog);

        $validated = $request->validate(['q' => ['nullable', 'string', 'max:100']]);

        try {
            $gifs = $gifCatalog->search($validated['q'] ?? '');
        } catch (RequestException|ConnectionException) {
            abort(502, __('GIF search is unavailable.'));
        }

        return response()->json([
            'gifs' => array_map(fn (Gif $gif) => [
                'id' => $gif->id,
                'previewUrl' => route('gifs.show', ['gif' => $gif->id, 'size' => 'preview'], false),
                'width' => $gif->width,
                'height' => $gif->height,
            ], $gifs),
        ]);
    }
}
```

`app/Http/Controllers/GifsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Support\Gifs\GifCatalog;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class GifsController extends Controller
{
    public function show(string $gif, string $size, GifCatalog $gifCatalog): Response
    {
        abort_unless($gifCatalog->isAvailable(), 404);

        try {
            $found = $gifCatalog->servable($gif);
        } catch (RequestException|ConnectionException) {
            abort(502, __('GIF search is unavailable.'));
        }

        abort_if($found === null, 404, __('This GIF could not be found.'));

        $disk = Storage::disk();
        $path = "gifs/{$gifCatalog->providerName()}/{$found->id}-{$size}";

        if (! $disk->exists($path)) {
            try {
                $body = Http::timeout(10)->get($size === 'preview' ? $found->previewUrl : $found->fullUrl)->throw()->body();
            } catch (RequestException|ConnectionException) {
                abort(502, __('GIF search is unavailable.'));
            }

            $disk->put($path, $body);
        }

        return response((string) $disk->get($path), 200, [
            'Content-Type' => $disk->mimeType($path) ?: 'image/gif',
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }
}
```

`AppServiceProvider::boot()` (imports `Illuminate\Cache\RateLimiting\Limit`, `Illuminate\Http\Request`, `Illuminate\Support\Facades\RateLimiter`, `App\Models\Participant`):

```php
        RateLimiter::for('gif-search', function (Request $request): Limit {
            $participant = $request->attributes->get('participant');

            return Limit::perMinute(20)->by($participant instanceof Participant ? $participant->id : (string) $request->ip());
        });
```

`routes/web.php` — inside the `retros/{retro}` group (it runs after `ResolveRetroParticipant`, so the limiter sees the participant):

```php
        Route::get('gifs', [RetroGifsController::class, 'index'])->name('retros.gifs.index')->middleware('throttle:gif-search');
```

and outside it, next to the avatars route:

```php
Route::get('gifs/{gif}/{size}', [GifsController::class, 'show'])
    ->where(['gif' => '[A-Za-z0-9_-]{1,64}', 'size' => 'preview|full'])
    ->middleware('throttle:240,1')
    ->name('gifs.show');
```

- [ ] **Step 6: Cards carry a GIF**

Migration (rename to `2026_09_30_090300_add_gif_to_cards_table.php`):

```php
        Schema::table('cards', function (Blueprint $table) {
            $table->text('content')->nullable()->change();
            $table->string('gif_id', 64)->nullable()->after('content');
        });
```

`Card.php`: `@property string|null $content`, `@property string|null $gif_id`; add `'gif_id'` to `#[Fillable]`.

`PresentCard::handle` — new fields and docblock keys `hidden: bool`, `gif: ?array{id: string, previewUrl: string, url: string}`:

```php
            'hidden' => $isHidden,
            'content' => $isHidden ? null : $card->content,
            'gif' => $isHidden || $card->gif_id === null ? null : [
                'id' => $card->gif_id,
                'previewUrl' => route('gifs.show', ['gif' => $card->gif_id, 'size' => 'preview'], false),
                'url' => route('gifs.show', ['gif' => $card->gif_id, 'size' => 'full'], false),
            ],
```

`BuildBoardSnapshot`: replace the Task 3 `$isHidden` line by `$isHidden = $presented['hidden'];`, and add to the `retro` array `'gifProvider' => $this->gifCatalog->providerName(),` (inject `private GifCatalog $gifCatalog`).

`CardsController` (inject `GifCatalog $gifCatalog` into the constructor as `private GifCatalog $gifCatalog`):

- `store` validation:

```php
            'content' => ['required_without:gif_id', 'nullable', 'string', 'max:1000'],
            'gif_id' => ['nullable', 'string', 'max:64', 'regex:/^[A-Za-z0-9_-]+$/'],
```

  after validation: `$this->ensureGif($retro, $validated['gif_id'] ?? null);`, and create the card with `'content' => $validated['content'] ?? null, 'gif_id' => $validated['gif_id'] ?? null`.
- `update` validation:

```php
            'content' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'gif_id' => ['sometimes', 'nullable', 'string', 'max:64', 'regex:/^[A-Za-z0-9_-]+$/'],
```

  after validation: `if (($validated['gif_id'] ?? null) !== null && $validated['gif_id'] !== $card->gif_id) { $this->ensureGif($retro, $validated['gif_id']); }`; inside the transaction replace `$fresh->update(['content' => …])` with:

```php
            $content = array_key_exists('content', $validated) ? $validated['content'] : $fresh->content;
            $gifId = array_key_exists('gif_id', $validated) ? $validated['gif_id'] : $fresh->gif_id;

            if ($content === null && $gifId === null) {
                throw ValidationException::withMessages(['content' => __('A card needs text or a GIF.')]);
            }

            $fresh->update(['content' => $content, 'gif_id' => $gifId]);
```

- new private method (imports `Illuminate\Validation\ValidationException`, `Illuminate\Http\Client\ConnectionException`, `Illuminate\Http\Client\RequestException`):

```php
    private function ensureGif(Retro $retro, ?string $gifId): void
    {
        if ($gifId === null) {
            return;
        }

        RetroGuard::gifsEnabled($retro, $this->gifCatalog);

        try {
            $gif = $this->gifCatalog->resolve($gifId);
        } catch (RequestException|ConnectionException) {
            abort(502, __('GIF search is unavailable.'));
        }

        if ($gif === null) {
            throw ValidationException::withMessages(['gif_id' => __('This GIF could not be found.')]);
        }
    }
```

- [ ] **Step 7: Translations**

| key | fr | es | de |
|---|---|---|---|
| GIFs are turned off for this board. | Les GIF sont désactivés pour ce tableau. | Los GIF están desactivados en este tablero. | GIFs sind für dieses Board ausgeschaltet. |
| GIF search is unavailable. | La recherche de GIF est indisponible. | La búsqueda de GIF no está disponible. | Die GIF-Suche ist nicht verfügbar. |
| This GIF could not be found. | Ce GIF est introuvable. | No se encontró este GIF. | Dieses GIF wurde nicht gefunden. |
| A card needs text or a GIF. | Une carte doit contenir du texte ou un GIF. | Una tarjeta necesita texto o un GIF. | Eine Karte braucht Text oder ein GIF. |

- [ ] **Step 8: Run the tests to verify they pass**

Run: `vendor/bin/sail artisan migrate --no-interaction && vendor/bin/sail artisan test --compact tests/Feature/Retros tests/Feature/TranslationKeysTest.php`
Expected: PASS (existing card tests included — `content` is still required when no GIF is sent).

- [ ] **Step 9: Format, analyse, commit**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress` → clean.

```bash
git add app config database routes lang tests .env.example
git commit -m "feat: attach gifs to cards through a server-side proxy"
```

---

### Task 6: Frontend foundation — dependencies, types, reducer, events, settings, lock, vote totals

**Files:**
- Modify: `package.json`, `package-lock.json` (npm install)
- Modify: `resources/js/lib/retro/types.ts`, `resources/js/lib/retro/board-reducer.ts`, `resources/js/hooks/use-retro-channel.ts`, `resources/js/hooks/use-retro-board.ts`, `resources/js/components/retro/board-context.tsx`, `board.tsx`, `board-header.tsx`, `settings-dialog.tsx`, `retro-card.tsx`, `vote-controls.tsx`, `card-composer.tsx`, `retro-column.tsx`, `action-items-panel.tsx`, `completed-summary.tsx`
- Create: `resources/js/components/retro/lock-badge.tsx`, `resources/js/hooks/use-comment-notifications.ts`
- Modify: `lang/*.json`

**Interfaces:**
- Consumes: Tasks 1–5 payloads.
- Produces (TS):

```ts
export type CardGif = { id: string; previewUrl: string; url: string };
export type ReactionSummary = { emoji: string; count: number; mine: boolean; names: string[] };
export type CardComment = {
    id: string; cardId: string; parentCommentId: string | null; isMine: boolean;
    deleted: boolean; content: string | null; author: Person | null; createdAt: string;
};
export type CommentThread = CardComment & { replies: CardComment[] };
export type CommentNotificationPayload = {
    cardId: string; commentId: string; threadId: string; excerpt: string; authorName?: string;
};
```

  `CardPayload` gains `hidden: boolean`, `gif: CardGif | null`; `BoardCard` gains `reactions: ReactionSummary[]`, `commentCount: number`, `comments: CommentThread[]`; `Snapshot.retro` gains `reactionsEnabled`, `cursorsEnabled`, `gifsEnabled`, `hideVoteCounts`, `isLocked`, `presentationMode` (boolean) and `gifProvider: 'giphy' | 'tenor' | null`.
  `BoardAction` gains `{ type: 'reactions.set'; cardId: string; reactions: Array<Omit<ReactionSummary, 'mine'> & { mine?: boolean }> }`, `{ type: 'comment.upsert'; comment: CardComment }`, `{ type: 'comment.remove'; cardId: string; commentId: string; soft: boolean }`, and `votes.cast` gains optional `cardId?: string; total?: number`.
  `useRetroChannel(retroId, participantId, enabled, handlers: RetroChannelHandlers)` with `RetroChannelHandlers = { onEvent, onResync, onJoining, onOwnCard, onOwnComment: (comment: CardComment) => void, onCommentNotification: (notification: CommentNotificationPayload) => void }`, returns `{ online, connected, reconnecting, presence: WhisperChannel | null }`.
  `BoardContextValue` gains `online: PresenceMember[]`, `presence: WhisperChannel | null`, `isEditable: boolean` (`!board.retro.isLocked`), `unreadCardIds: Set<string>`, `markCommentsRead: (cardId: string) => void`.
  `WhisperChannel` (in `resources/js/lib/retro/whisper-transport.ts`, created here with only the type, filled in Task 10): `{ whisper(event: string, data: unknown): unknown; listen(event: string, callback: (data: unknown, metadata?: { user_id?: string }) => void): unknown; stopListening(event: string, callback?: (...args: never[]) => void): unknown }`.

- [ ] **Step 1: Install the dependencies**

Run: `npm install live-cursors@^0.2.0 live-reactions@^0.2.0 frimousse@^0.4.0`
Then: `grep -n '"live-cursors"\|"live-reactions"\|"frimousse"' package.json` → three lines under `dependencies`, nothing else changed in `dependencies`.

- [ ] **Step 2: Types**

Apply the TS types above to `resources/js/lib/retro/types.ts`. Create `resources/js/lib/retro/whisper-transport.ts` with the exported `WhisperChannel` type only.

- [ ] **Step 3: Reducer**

`board-reducer.ts`:

`upsertCards` keeps the snapshot-only fields when a broadcast card arrives:

```ts
        byId.set(payload.id, {
            votes: existing?.votes ?? null,
            myVotes: existing?.myVotes ?? 0,
            reactions: existing?.reactions ?? [],
            commentCount: existing?.commentCount ?? 0,
            comments: existing?.comments ?? [],
            ...payload,
            ...(keepsOwnView && {
                isMine: true,
                hidden: false,
                content: payload.content ?? existing.content,
                gif: payload.gif ?? existing.gif,
                author: payload.author ?? existing.author,
            }),
        });
```

`votes.cast` also applies a card total when it carries one:

```ts
        case 'votes.cast':
            if (action.votesVersion <= state.votesVersion) {
                return state;
            }

            return {
                ...state,
                votesCast: action.votesCast,
                votesVersion: action.votesVersion,
                cards:
                    action.cardId === undefined || action.total === undefined
                        ? state.cards
                        : state.cards.map((card) =>
                              card.id === action.cardId
                                  ? { ...card, votes: action.total ?? null }
                                  : card,
                          ),
            };
```

New helpers and cases:

```ts
function countComments(threads: CommentThread[]): number {
    return threads.reduce(
        (total, thread) =>
            total +
            (thread.deleted ? 0 : 1) +
            thread.replies.filter((reply) => !reply.deleted).length,
        0,
    );
}

export function upsertComment(
    threads: CommentThread[],
    comment: CardComment,
): CommentThread[] {
    if (comment.parentCommentId === null) {
        const exists = threads.some((thread) => thread.id === comment.id);

        return exists
            ? threads.map((thread) =>
                  thread.id === comment.id
                      ? { ...comment, replies: thread.replies }
                      : thread,
              )
            : [...threads, { ...comment, replies: [] }];
    }

    return threads.map((thread) => {
        if (thread.id !== comment.parentCommentId) {
            return thread;
        }

        const exists = thread.replies.some((reply) => reply.id === comment.id);

        return {
            ...thread,
            replies: exists
                ? thread.replies.map((reply) =>
                      reply.id === comment.id ? comment : reply,
                  )
                : [...thread.replies, comment],
        };
    });
}

export function removeComment(
    threads: CommentThread[],
    commentId: string,
    soft: boolean,
): CommentThread[] {
    if (soft) {
        return threads.map((thread) =>
            thread.id === commentId
                ? { ...thread, deleted: true, content: null, author: null }
                : thread,
        );
    }

    return threads
        .filter((thread) => thread.id !== commentId)
        .map((thread) => ({
            ...thread,
            replies: thread.replies.filter((reply) => reply.id !== commentId),
        }));
}

function updateCard(
    state: Snapshot,
    cardId: string,
    change: (card: BoardCard) => BoardCard,
): Snapshot {
    return {
        ...state,
        cards: state.cards.map((card) =>
            card.id === cardId ? change(card) : card,
        ),
    };
}
```

```ts
        case 'reactions.set':
            return updateCard(state, action.cardId, (card) => ({
                ...card,
                reactions: action.reactions.map((reaction) => ({
                    ...reaction,
                    mine:
                        reaction.mine ??
                        card.reactions.some(
                            (existing) =>
                                existing.emoji === reaction.emoji &&
                                existing.mine,
                        ),
                })),
            }));
        case 'comment.upsert':
            return updateCard(state, action.comment.cardId, (card) => {
                const comments = upsertComment(card.comments, action.comment);

                return { ...card, comments, commentCount: countComments(comments) };
            });
        case 'comment.remove':
            return updateCard(state, action.cardId, (card) => {
                const comments = removeComment(
                    card.comments,
                    action.commentId,
                    action.soft,
                );

                return { ...card, comments, commentCount: countComments(comments) };
            });
```

(A comment broadcast to others is presented without a viewer, so `upsertComment` must keep `isMine`/`author` of a comment the viewer already holds as their own: in `upsertComment`, when replacing an existing comment whose `isMine` is true and the incoming one is not, merge `{ ...incoming, isMine: true, author: incoming.author ?? existing.author }` — mirror `keepsOwnView`.)

- [ ] **Step 4: Channel hook**

`use-retro-channel.ts`:
- add `'card.reactions.changed'`, `'comment.created'`, `'comment.updated'`, `'comment.deleted'` to `RetroEvents`;
- change the signature to `useRetroChannel(retroId: string, participantId: string, enabled: boolean, handlers: RetroChannelHandlers)` and store `handlers` in the existing ref (`handlersRef.current = handlers`), replacing the positional callbacks;
- keep the joined presence channel in state: `const [presence, setPresence] = useState<WhisperChannel | null>(null);` — after the `.error(scheduleResync)` call on the presence channel, `setPresence(channel as unknown as WhisperChannel);`, and `setPresence(null);` in the cleanup;
- on the private channel, after the `own-card.saved` listener:

```ts
            .listen('.own-comment.saved', (payload: { comment: CardComment }) =>
                handlersRef.current.onOwnComment(payload.comment),
            )
            .listen(
                '.comment.notification',
                (payload: CommentNotificationPayload) =>
                    handlersRef.current.onCommentNotification(payload),
            )
```

- return `{ online, connected, reconnecting, presence }`.

- [ ] **Step 5: Notifications state**

`resources/js/hooks/use-comment-notifications.ts`:

```ts
import { useCallback, useState } from 'react';

const storageKey = (retroId: string) => `skrum.readComments.${retroId}`;

function readMarks(retroId: string): Record<string, string> {
    try {
        return JSON.parse(
            window.localStorage.getItem(storageKey(retroId)) ?? '{}',
        ) as Record<string, string>;
    } catch {
        return {};
    }
}

/**
 * Cards with a comment notification the viewer has not opened yet. Read
 * marks survive reloads per browser; unread state itself comes only from
 * live notifications, so nothing is replayed from before the page loaded.
 */
export function useCommentNotifications(retroId: string) {
    const [notifiedAt, setNotifiedAt] = useState<Record<string, string>>({});
    const [readAt, setReadAt] = useState<Record<string, string>>(() =>
        typeof window === 'undefined' ? {} : readMarks(retroId),
    );

    const notify = useCallback((cardId: string) => {
        setNotifiedAt((current) => ({
            ...current,
            [cardId]: new Date().toISOString(),
        }));
    }, []);

    const markRead = useCallback(
        (cardId: string) => {
            const next = { ...readMarks(retroId), [cardId]: new Date().toISOString() };

            try {
                window.localStorage.setItem(storageKey(retroId), JSON.stringify(next));
            } catch {
                // Storage can be full or disabled; the dot then clears for this page only.
            }

            setReadAt(next);
        },
        [retroId],
    );

    const unreadCardIds = new Set(
        Object.entries(notifiedAt)
            .filter(([cardId, at]) => (readAt[cardId] ?? '') < at)
            .map(([cardId]) => cardId),
    );

    return { unreadCardIds, notify, markRead };
}
```

- [ ] **Step 6: Board hook and context**

`use-retro-board.ts`:
- `onEvent` gains:

```ts
                case 'vote.cast':
                case 'vote.retracted':
                    apply({
                        type: 'votes.cast',
                        votesCast: payload.votesCast as number,
                        votesVersion: payload.votesVersion as number,
                        cardId: payload.cardId as string | undefined,
                        total: payload.total as number | undefined,
                    });
                    break;
                case 'card.reactions.changed':
                    apply({
                        type: 'reactions.set',
                        cardId: payload.cardId as string,
                        reactions: payload.reactions as Array<
                            Omit<ReactionSummary, 'mine'>
                        >,
                    });
                    break;
                case 'comment.created':
                case 'comment.updated':
                    apply({
                        type: 'comment.upsert',
                        comment: payload.comment as CardComment,
                    });
                    break;
                case 'comment.deleted':
                    apply({
                        type: 'comment.remove',
                        cardId: payload.cardId as string,
                        commentId: payload.commentId as string,
                        soft: payload.soft as boolean,
                    });
                    break;
```

  (replacing the existing `vote.cast` / `vote.retracted` case);
- `const notifications = useCommentNotifications(retroId);`
- `onOwnComment = useCallback((comment: CardComment) => apply({ type: 'comment.upsert', comment }), [apply])`;
- `onCommentNotification`:

```ts
    const onCommentNotification = useCallback(
        (notification: CommentNotificationPayload) => {
            notifications.notify(notification.cardId);
            toast(
                notification.threadId === notification.commentId
                    ? t('New comment on your card')
                    : t('New reply in a thread you follow'),
                {
                    description: notification.authorName
                        ? `${notification.authorName}: ${notification.excerpt}`
                        : notification.excerpt,
                },
            );
        },
        [notifications.notify, t],
    );
```

- call `useRetroChannel(retroId, initial.viewer.participantId, status === 'active', { onEvent, onResync: refetch, onJoining, onOwnCard, onOwnComment, onCommentNotification })`;
- return `presence`, `unreadCardIds: notifications.unreadCardIds`, `markCommentsRead: notifications.markRead` as well.

`board-context.tsx`: add `online`, `presence`, `isEditable`, `unreadCardIds`, `markCommentsRead` to `BoardContextValue`. `board.tsx`: pass them (`isEditable: !board.retro.isLocked`).

- [ ] **Step 7: Settings dialog, lock badge, locked controls, vote totals**

`settings-dialog.tsx` — six more checkboxes following the anonymity checkbox pattern, each with its own `useState(retro.<flag>)` and a `changes.<snake_case> = value` entry when it differs:

| state | checkbox label key | payload key | shown when |
|---|---|---|---|
| `reactionsEnabled` | Show reactions | `reactions_enabled` | always |
| `cursorsEnabled` | Show live cursors | `cursors_enabled` | always |
| `gifsEnabled` | Allow GIFs | `gifs_enabled` | `retro.gifProvider !== null` |
| `hideVoteCounts` | Hide vote counts | `hide_vote_counts` | always |
| `isLocked` | Close for editing | `is_locked` | always |
| `presentationMode` | Presentation mode | `presentation_mode` | always |

All six are disabled when `retro.phase === 'completed'`.

`resources/js/components/retro/lock-badge.tsx`:

```tsx
import { Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import { useBoard } from './board-context';

export function LockBadge() {
    const { board } = useBoard();
    const { t } = useTrans();

    if (!board.retro.isLocked) {
        return null;
    }

    return (
        <Badge variant="secondary" className="gap-1">
            <Lock className="size-3" aria-hidden="true" />
            {t('Board closed for editing')}
        </Badge>
    );
}
```

Render `<LockBadge />` in `board-header.tsx` right after the `<h1>`.

Locked controls (use `ctx.isEditable`):
- `retro-card.tsx`: `canChange` also requires `ctx.isEditable`; the ungroup button renders only when `ctx.isEditable`; the vote-count badge also renders in `voting` when `card.votes !== null` (condition becomes `(phase === 'voting' && card.votes !== null) || phase === 'discussing' || phase === 'completed'`);
- `vote-controls.tsx`: both buttons `disabled` also when `!ctx.isEditable`; the response apply becomes `ctx.apply({ type: 'votes.cast', votesCast: tally.votesCast, votesVersion: tally.votesVersion, cardId: tally.cardId, total: tally.total ?? undefined })` and `Tally` gains `total: number | null`;
- `retro-column.tsx`: the `CardComposer` renders only when `ctx.isEditable`; drag handles/sortable are disabled when `!ctx.isEditable` (pass `disabled: !ctx.isEditable` to the existing `useSortable` / `useDraggable` calls in `dnd.tsx` through a prop);
- `action-items-panel.tsx`: the add form, the done checkbox, the assignee select and the delete button are disabled when `!ctx.isEditable`;
- `completed-summary.tsx` and `CardPreview`: use `card.hidden` instead of `card.content === null` to decide "Hidden until writing ends" (same in `RetroCard`).

- [ ] **Step 8: Translations**

| key | fr | es | de |
|---|---|---|---|
| Board closed for editing | Tableau fermé aux modifications | Tablero cerrado a los cambios | Board für Änderungen gesperrt |
| Show reactions | Afficher les réactions | Mostrar reacciones | Reaktionen anzeigen |
| Show live cursors | Afficher les curseurs en direct | Mostrar cursores en directo | Live-Cursor anzeigen |
| Allow GIFs | Autoriser les GIF | Permitir GIF | GIFs erlauben |
| Hide vote counts | Masquer le nombre de votes | Ocultar el número de votos | Stimmenzahl ausblenden |
| Close for editing | Fermer aux modifications | Cerrar a los cambios | Für Änderungen sperren |
| Presentation mode | Mode présentation | Modo presentación | Präsentationsmodus |
| New comment on your card | Nouveau commentaire sur votre carte | Nuevo comentario en tu tarjeta | Neuer Kommentar zu deiner Karte |
| New reply in a thread you follow | Nouvelle réponse dans une discussion que vous suivez | Nueva respuesta en un hilo que sigues | Neue Antwort in einem Thread, dem du folgst |

- [ ] **Step 9: Verify**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check` → clean (known failures only).
Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php` → PASS.
Manual (best-effort): the board loads; toggling "Close for editing" shows the badge in a second browser and disables editing; vote totals appear live during Voting.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json resources/js lang
git commit -m "feat: wire engagement settings, lock state and live vote totals into the board"
```

---

### Task 7: Emoji picker and card reactions UI

**Files:**
- Create: `resources/js/lib/retro/emoji.ts`, `resources/js/components/retro/emoji-picker.tsx`, `resources/js/components/retro/card-reactions.tsx`
- Modify: `resources/js/components/retro/retro-card.tsx`, `lang/*.json`

**Interfaces:**
- Consumes: Task 3 routes (Wayfinder `CardReactionsController.update/destroy`), Task 6 `reactions.set`, `ctx.isEditable`.
- Produces: `QuickEmoji: readonly string[]` (`['👍', '❤️', '👏', '🎉', '🤔', '👎']`), `isSingleEmoji(value: unknown): value is string`, `EmojiPicker({ onPick, label, children })` (dropdown with the quick emoji and "More emoji…" opening a dialog with the full picker), `CardReactions({ card })`.

- [ ] **Step 1: Emoji helpers**

`resources/js/lib/retro/emoji.ts`:

```ts
export const QuickEmoji = ['👍', '❤️', '👏', '🎉', '🤔', '👎'] as const;

const MaxBytes = 64;
const EmojiStart =
    /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2}|[0-9#*]️?⃣)/u;
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Mirrors App\Rules\SingleEmoji, for messages that never reach the server. */
export function isSingleEmoji(value: unknown): value is string {
    if (typeof value !== 'string' || value === '') {
        return false;
    }

    if (new TextEncoder().encode(value).length > MaxBytes) {
        return false;
    }

    if ([...graphemes.segment(value)].length !== 1) {
        return false;
    }

    return EmojiStart.test(value);
}
```

- [ ] **Step 2: Picker**

`resources/js/components/retro/emoji-picker.tsx`:

```tsx
import { EmojiPicker as Frimousse } from 'frimousse';
import { useState, type ReactNode } from 'react';
import {
    Dialog,
    DialogContent,
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
import { QuickEmoji } from '@/lib/retro/emoji';

type Props = {
    onPick: (emoji: string) => void;
    label: string;
    children: ReactNode;
};

export function EmojiPicker({ onPick, label, children }: Props) {
    const { t } = useTrans();
    const [browsing, setBrowsing] = useState(false);

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild aria-label={label}>
                    {children}
                </DropdownMenuTrigger>
                <DropdownMenuContent className="flex flex-wrap gap-1 p-1">
                    {QuickEmoji.map((emoji) => (
                        <DropdownMenuItem
                            key={emoji}
                            className="px-2 text-lg"
                            onSelect={() => onPick(emoji)}
                        >
                            {emoji}
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator className="w-full" />
                    <DropdownMenuItem
                        className="w-full"
                        onSelect={() => setBrowsing(true)}
                    >
                        {t('More emoji…')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={browsing} onOpenChange={setBrowsing}>
                <DialogContent aria-describedby={undefined} className="max-w-sm">
                    <DialogTitle>{label}</DialogTitle>
                    <Frimousse.Root
                        className="flex h-80 flex-col"
                        onEmojiSelect={({ emoji }) => {
                            setBrowsing(false);
                            onPick(emoji);
                        }}
                    >
                        <Frimousse.Search
                            className="mb-2 rounded-md border bg-background px-2 py-1 text-sm"
                            placeholder={t('Search emoji…')}
                            aria-label={t('Search emoji…')}
                        />
                        <Frimousse.Viewport className="relative flex-1">
                            <Frimousse.Loading className="p-2 text-sm text-muted-foreground">
                                {t('Loading…')}
                            </Frimousse.Loading>
                            <Frimousse.Empty className="p-2 text-sm text-muted-foreground">
                                {t('No emoji found.')}
                            </Frimousse.Empty>
                            <Frimousse.List
                                className="select-none"
                                components={{
                                    CategoryHeader: ({ category, ...props }) => (
                                        <div
                                            className="bg-background px-1 pt-2 pb-1 text-xs font-medium text-muted-foreground"
                                            {...props}
                                        >
                                            {category.label}
                                        </div>
                                    ),
                                    Emoji: ({ emoji, ...props }) => (
                                        <button
                                            className="flex size-8 items-center justify-center rounded text-lg data-[active]:bg-accent"
                                            {...props}
                                        >
                                            {emoji.emoji}
                                        </button>
                                    ),
                                }}
                            />
                        </Frimousse.Viewport>
                    </Frimousse.Root>
                </DialogContent>
            </Dialog>
        </>
    );
}
```

(frimousse downloads Emojibase data from `cdn.jsdelivr.net` on first open and caches it in `localStorage`; see the report note in "Open points".)

- [ ] **Step 3: Card reactions**

`resources/js/components/retro/card-reactions.tsx`:

```tsx
import { SmilePlus } from 'lucide-react';
import CardReactionsController from '@/actions/App/Http/Controllers/Retros/CardReactionsController';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { BoardCard, ReactionSummary } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { useBoard } from './board-context';
import { EmojiPicker } from './emoji-picker';

type Response = { cardId: string; reactions: ReactionSummary[] };

const ReactionPhases = ['grouping', 'voting', 'discussing'];

export function CardReactions({ card }: { card: BoardCard }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const { retro } = ctx.board;
    const canReact =
        retro.reactionsEnabled &&
        ctx.isEditable &&
        ReactionPhases.includes(retro.phase);

    if (!retro.reactionsEnabled || card.hidden) {
        return null;
    }

    const toggle = async (emoji: string) => {
        const existing = card.reactions.find((reaction) => reaction.emoji === emoji);
        const removing = existing?.mine === true;
        const route = { retro: retro.id, card: card.id };

        ctx.dispatch({
            type: 'reactions.set',
            cardId: card.id,
            reactions: optimistic(card.reactions, emoji, removing),
        });

        const response = await ctx.run(
            retroRequest<Response>(
                removing
                    ? CardReactionsController.destroy(route)
                    : CardReactionsController.update(route),
                { emoji },
            ),
        );

        if (response) {
            ctx.apply({
                type: 'reactions.set',
                cardId: response.cardId,
                reactions: response.reactions,
            });
        }
    };

    return (
        <div className="mt-2 flex flex-wrap items-center gap-1">
            {card.reactions.map((reaction) => (
                <Tooltip key={reaction.emoji}>
                    <TooltipTrigger asChild>
                        <Button
                            size="sm"
                            variant="outline"
                            className={cn(
                                'h-6 gap-1 rounded-full px-2 text-xs',
                                reaction.mine && 'border-primary bg-primary/10',
                            )}
                            aria-pressed={reaction.mine}
                            aria-label={t(':emoji, :count reactions', {
                                emoji: reaction.emoji,
                                count: reaction.count,
                            })}
                            disabled={!canReact}
                            onClick={() => void toggle(reaction.emoji)}
                        >
                            <span>{reaction.emoji}</span>
                            <span>{reaction.count}</span>
                        </Button>
                    </TooltipTrigger>
                    {reaction.names.length > 0 && (
                        <TooltipContent>{reaction.names.join(', ')}</TooltipContent>
                    )}
                </Tooltip>
            ))}
            {canReact && (
                <EmojiPicker
                    label={t('Add a reaction')}
                    onPick={(emoji) => void toggle(emoji)}
                >
                    <Button size="icon" variant="ghost" className="size-6">
                        <SmilePlus className="size-3.5" />
                    </Button>
                </EmojiPicker>
            )}
        </div>
    );
}

function optimistic(
    reactions: ReactionSummary[],
    emoji: string,
    removing: boolean,
): ReactionSummary[] {
    const existing = reactions.find((reaction) => reaction.emoji === emoji);

    if (removing && existing) {
        return reactions
            .map((reaction) =>
                reaction.emoji === emoji
                    ? { ...reaction, count: reaction.count - 1, mine: false }
                    : reaction,
            )
            .filter((reaction) => reaction.count > 0);
    }

    if (existing) {
        return reactions.map((reaction) =>
            reaction.emoji === emoji
                ? { ...reaction, count: reaction.count + 1, mine: true }
                : reaction,
        );
    }

    return [...reactions, { emoji, count: 1, mine: true, names: [] }];
}
```

(A failed request goes through `ctx.run`, which toasts and refetches — the refetch replaces the optimistic state, which is the rollback.)

In `retro-card.tsx`, render `<CardReactions card={card} />` right after the content block and before the footer row, for top-level and child cards alike.

- [ ] **Step 4: Translations**

| key | fr | es | de |
|---|---|---|---|
| Add a reaction | Ajouter une réaction | Añadir una reacción | Reaktion hinzufügen |
| More emoji… | Plus d'emoji… | Más emoji… | Mehr Emoji… |
| Search emoji… | Rechercher un emoji… | Buscar emoji… | Emoji suchen… |
| No emoji found. | Aucun emoji trouvé. | No se encontró ningún emoji. | Kein Emoji gefunden. |
| :emoji, :count reactions | :emoji, :count réactions | :emoji, :count reacciones | :emoji, :count Reaktionen |
| Loading… | Chargement… | Cargando… | Wird geladen… |

- [ ] **Step 5: Verify and commit**

Run: `npm run types:check && npm run check` → clean; `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php` → PASS.
Manual: react with a quick emoji and a picker emoji (e.g. 👨‍👩‍👧‍👦) in one browser; the chip appears in the other; toggling off removes it.

```bash
git add resources/js lang
git commit -m "feat: react to cards from quick emoji or a full picker"
```

---

### Task 8: Comment threads and notification dots

**Files:**
- Create: `resources/js/components/retro/card-comments.tsx`
- Modify: `resources/js/components/retro/retro-card.tsx`, `lang/*.json`

**Interfaces:**
- Consumes: Task 4 routes (Wayfinder `CardCommentsController.store/update/destroy`), Task 6 `comment.upsert` / `comment.remove`, `ctx.unreadCardIds`, `ctx.markCommentsRead`.
- Produces: `CardComments({ card })` — a toggle button with the count and an unread dot, and the inline thread.

- [ ] **Step 1: Component**

`resources/js/components/retro/card-comments.tsx`:

```tsx
import { MessageSquare, Pencil, Reply, Trash2 } from 'lucide-react';
import { useState } from 'react';
import CardCommentsController from '@/actions/App/Http/Controllers/Retros/CardCommentsController';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type {
    BoardCard,
    CardComment,
    CommentThread,
} from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { useBoard } from './board-context';

const CommentPhases = ['grouping', 'voting', 'discussing'];

export function CardComments({ card }: { card: BoardCard }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const phase = ctx.board.retro.phase;
    const isUnread = ctx.unreadCardIds.has(card.id);

    if (card.hidden || (phase === 'writing' && card.commentCount === 0)) {
        return null;
    }

    const toggle = () => {
        if (!open) {
            ctx.markCommentsRead(card.id);
        }

        setOpen(!open);
    };

    return (
        <div className="mt-2">
            <Button
                size="sm"
                variant="ghost"
                className="relative h-7 gap-1"
                aria-expanded={open}
                aria-label={t('Comments (:count)', { count: card.commentCount })}
                onClick={toggle}
            >
                <MessageSquare className="size-3.5" />
                {card.commentCount}
                {isUnread && (
                    <span
                        className="absolute top-1 right-1 size-2 rounded-full bg-primary"
                        aria-label={t('Unread comments')}
                    />
                )}
            </Button>
            {open && <Thread card={card} />}
        </div>
    );
}

function Thread({ card }: { card: BoardCard }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const canWrite =
        ctx.isEditable && CommentPhases.includes(ctx.board.retro.phase);

    return (
        <div className="mt-2 space-y-3 border-l pl-3">
            {card.comments.map((thread) => (
                <ThreadItem key={thread.id} card={card} thread={thread} canWrite={canWrite} />
            ))}
            {canWrite && (
                <CommentForm
                    card={card}
                    parentCommentId={null}
                    placeholder={t('Write a comment…')}
                />
            )}
        </div>
    );
}

function ThreadItem({
    card,
    thread,
    canWrite,
}: {
    card: BoardCard;
    thread: CommentThread;
    canWrite: boolean;
}) {
    const { t } = useTrans();
    const [expanded, setExpanded] = useState(false);
    const [replying, setReplying] = useState(false);

    return (
        <div className="space-y-2">
            <CommentItem comment={thread} canWrite={canWrite} />
            {thread.replies.length > 0 && (
                <Button
                    size="sm"
                    variant="link"
                    className="h-auto p-0 text-xs"
                    aria-expanded={expanded}
                    onClick={() => setExpanded(!expanded)}
                >
                    {thread.replies.length === 1
                        ? t('1 reply')
                        : t(':count replies', { count: thread.replies.length })}
                </Button>
            )}
            {expanded && (
                <div className="space-y-2 pl-4">
                    {thread.replies.map((reply) => (
                        <CommentItem key={reply.id} comment={reply} canWrite={canWrite} />
                    ))}
                </div>
            )}
            {canWrite && !replying && (
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 text-xs"
                    onClick={() => {
                        setReplying(true);
                        setExpanded(true);
                    }}
                >
                    <Reply className="size-3" />
                    {t('Reply')}
                </Button>
            )}
            {replying && (
                <div className="pl-4">
                    <CommentForm
                        card={card}
                        parentCommentId={thread.id}
                        placeholder={t('Write a reply…')}
                        onDone={() => setReplying(false)}
                    />
                </div>
            )}
        </div>
    );
}

function CommentItem({
    comment,
    canWrite,
}: {
    comment: CardComment;
    canWrite: boolean;
}) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [editing, setEditing] = useState(false);
    const canDelete =
        canWrite &&
        !comment.deleted &&
        (comment.isMine || ctx.board.viewer.isFacilitator);

    if (comment.deleted) {
        return (
            <p className="text-xs text-muted-foreground italic">
                {t('Comment deleted')}
            </p>
        );
    }

    const remove = async () => {
        const result = await ctx.run(
            retroRequest(
                CardCommentsController.destroy({
                    retro: ctx.board.retro.id,
                    comment: comment.id,
                }),
            ),
        );

        if (result !== undefined) {
            await ctx.refetch();
        }
    };

    if (editing) {
        return (
            <CommentForm
                card={null}
                comment={comment}
                parentCommentId={comment.parentCommentId}
                placeholder={t('Edit comment')}
                onDone={() => setEditing(false)}
            />
        );
    }

    return (
        <div className="text-xs">
            <p className="font-medium">
                {comment.author?.name ?? t('Anonymous')}
            </p>
            <p className="break-words whitespace-pre-wrap">{comment.content}</p>
            {(comment.isMine || canDelete) && canWrite && (
                <div className="mt-1 flex gap-1">
                    {comment.isMine && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            aria-label={t('Edit comment')}
                            onClick={() => setEditing(true)}
                        >
                            <Pencil className="size-3" />
                        </Button>
                    )}
                    {canDelete && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className="size-6"
                            aria-label={t('Delete comment')}
                            onClick={() => void remove()}
                        >
                            <Trash2 className="size-3" />
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

function CommentForm({
    card,
    comment,
    parentCommentId,
    placeholder,
    onDone,
}: {
    card: BoardCard | null;
    comment?: CardComment;
    parentCommentId: string | null;
    placeholder: string;
    onDone?: () => void;
}) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [content, setContent] = useState(comment?.content ?? '');
    const [sending, setSending] = useState(false);

    const submit = async () => {
        const trimmed = content.trim();

        if (trimmed === '' || sending) {
            return;
        }

        setSending(true);

        const retro = ctx.board.retro.id;
        const response = await ctx.run(
            retroRequest<{ comment: CardComment }>(
                comment
                    ? CardCommentsController.update({ retro, comment: comment.id })
                    : CardCommentsController.store({ retro, card: card!.id }),
                comment
                    ? { content: trimmed }
                    : { content: trimmed, parentCommentId },
            ),
        );

        setSending(false);

        if (!response) {
            return;
        }

        ctx.apply({ type: 'comment.upsert', comment: response.comment });
        setContent('');
        onDone?.();
    };

    return (
        <form
            className={cn('space-y-1')}
            onSubmit={(event) => {
                event.preventDefault();
                void submit();
            }}
        >
            <Textarea
                value={content}
                maxLength={500}
                rows={2}
                placeholder={placeholder}
                aria-label={placeholder}
                onChange={(event) => setContent(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void submit();
                    }
                }}
            />
            <div className="flex justify-end gap-1">
                {onDone && (
                    <Button type="button" size="sm" variant="ghost" onClick={onDone}>
                        {t('Cancel')}
                    </Button>
                )}
                <Button size="sm" disabled={sending || content.trim() === ''}>
                    {comment ? t('Save') : t('Reply')}
                </Button>
            </div>
        </form>
    );
}
```

(`CommentForm` for a new top-level comment receives `card`; for an edit it receives `comment` and `card={null}` — the non-null assertion is only reached when `comment` is undefined. If lint forbids `!`, split into `NewCommentForm` and `EditCommentForm` with the same body.)

In `retro-card.tsx`, render `<CardComments card={card} />` after `<CardReactions card={card} />`, for top-level and child cards.

- [ ] **Step 2: Translations**

| key | fr | es | de |
|---|---|---|---|
| Comments (:count) | Commentaires (:count) | Comentarios (:count) | Kommentare (:count) |
| Unread comments | Commentaires non lus | Comentarios sin leer | Ungelesene Kommentare |
| Write a comment… | Écrire un commentaire… | Escribe un comentario… | Schreib einen Kommentar… |
| Write a reply… | Écrire une réponse… | Escribe una respuesta… | Schreib eine Antwort… |
| Reply | Répondre | Responder | Antworten |
| 1 reply | 1 réponse | 1 respuesta | 1 Antwort |
| :count replies | :count réponses | :count respuestas | :count Antworten |
| Comment deleted | Commentaire supprimé | Comentario eliminado | Kommentar gelöscht |
| Edit comment | Modifier le commentaire | Editar comentario | Kommentar bearbeiten |
| Delete comment | Supprimer le commentaire | Eliminar comentario | Kommentar löschen |
| Anonymous | Anonyme | Anónimo | Anonym |

- [ ] **Step 3: Verify and commit**

Run: `npm run types:check && npm run check` → clean; `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php` → PASS.
Manual (two browsers): comment on the other's card → toast and unread dot there; opening the thread clears the dot and it stays cleared after reload; reply to a reply lands in the same thread; deleting a parent with replies shows "Comment deleted".

```bash
git add resources/js lang
git commit -m "feat: show threaded comments with unread notifications on cards"
```

---

### Task 9: GIF picker and GIFs on cards

**Files:**
- Create: `resources/js/components/retro/gif-picker.tsx`, `resources/js/components/retro/card-gif.tsx`
- Modify: `resources/js/components/retro/card-composer.tsx`, `card-editor.tsx`, `retro-card.tsx`, `lang/*.json`

**Interfaces:**
- Consumes: Task 5 `retros.gifs.index` (Wayfinder `RetroGifsController.index`), card `gif`, `retro.gifProvider`, `retro.gifsEnabled`.
- Produces: `GifPicker({ open, onOpenChange, onPick })` (`onPick(gif: PickedGif)` with `PickedGif = { id: string; previewUrl: string }`), `CardGif({ gif })`.

- [ ] **Step 1: Picker**

`resources/js/components/retro/gif-picker.tsx`:

```tsx
import { useEffect, useState } from 'react';
import RetroGifsController from '@/actions/App/Http/Controllers/Retros/RetroGifsController';
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import { useBoard } from './board-context';

export type PickedGif = { id: string; previewUrl: string };

type Result = PickedGif & { width: number; height: number };

const SearchDelayMs = 300;

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPick: (gif: PickedGif) => void;
};

export function GifPicker({ open, onOpenChange, onPick }: Props) {
    const { board } = useBoard();
    const { t } = useTrans();
    const [query, setQuery] = useState('');
    const [gifs, setGifs] = useState<Result[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        const timer = setTimeout(() => {
            retroRequest<{ gifs: Result[] }>(
                RetroGifsController.index(board.retro.id, {
                    query: { q: query },
                }),
            )
                .then((response) => {
                    setGifs(response.gifs);
                    setError(null);
                })
                .catch((caught: unknown) => {
                    const tooMany =
                        caught instanceof RetroRequestError &&
                        caught.status === 429;

                    setError(
                        tooMany
                            ? t('Too many searches, wait a moment.')
                            : t('GIF search is unavailable.'),
                    );
                });
        }, SearchDelayMs);

        return () => clearTimeout(timer);
    }, [open, query, board.retro.id, t]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="max-w-lg">
                <DialogTitle>{t('Choose a GIF')}</DialogTitle>
                <Input
                    value={query}
                    placeholder={t('Search GIFs…')}
                    aria-label={t('Search GIFs…')}
                    autoFocus
                    onChange={(event) => setQuery(event.target.value)}
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="grid max-h-96 grid-cols-3 gap-2 overflow-y-auto">
                    {gifs.map((gif) => (
                        <button
                            key={gif.id}
                            type="button"
                            className="overflow-hidden rounded-md focus-visible:ring-2 focus-visible:ring-primary"
                            onClick={() => {
                                onPick({ id: gif.id, previewUrl: gif.previewUrl });
                                onOpenChange(false);
                            }}
                        >
                            <img
                                src={gif.previewUrl}
                                alt=""
                                width={gif.width}
                                height={gif.height}
                                loading="lazy"
                                className="h-auto w-full"
                            />
                        </button>
                    ))}
                </div>
                {!error && gifs.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t('No GIFs found.')}</p>
                )}
                <p className="text-right text-xs text-muted-foreground">
                    {t('Powered by :provider', {
                        provider: board.retro.gifProvider === 'tenor' ? 'Tenor' : 'GIPHY',
                    })}
                </p>
            </DialogContent>
        </Dialog>
    );
}
```

(Check that the generated `RetroGifsController.index` accepts `(args, { query })` — Wayfinder route functions take `options?: RouteQueryOptions`.)

- [ ] **Step 2: GIF on a card**

`resources/js/components/retro/card-gif.tsx`:

```tsx
import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import type { CardGif as CardGifPayload } from '@/lib/retro/types';

export function CardGif({ gif }: { gif: CardGifPayload }) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                className="mb-2 block w-full overflow-hidden rounded-md"
                aria-label={t('GIF')}
                onClick={() => setOpen(true)}
            >
                <img src={gif.previewUrl} alt="" loading="lazy" className="h-auto w-full" />
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent aria-describedby={undefined}>
                    <DialogTitle className="sr-only">{t('GIF')}</DialogTitle>
                    <img src={gif.url} alt="" className="h-auto w-full rounded-md" />
                </DialogContent>
            </Dialog>
        </>
    );
}
```

`retro-card.tsx`: when `!card.hidden && card.gif`, render `<CardGif gif={card.gif} />` above the text; render the text paragraph only when `card.content !== null`; the "Hidden until writing ends" line renders when `card.hidden`.

- [ ] **Step 3: Composer and editor**

Shared rule: GIFs can be attached when `board.retro.gifProvider !== null && board.retro.gifsEnabled && ctx.isEditable`.

`card-composer.tsx`:
- `const [gif, setGif] = useState<PickedGif | null>(null); const [picking, setPicking] = useState(false);`
- `submit` sends `{ column_id: columnId, content: trimmed === '' ? null : trimmed, gif_id: gif?.id ?? null }` and returns early only when `trimmed === '' && gif === null`; on success `setGif(null)`;
- above the textarea, when `gif`: `<img src={gif.previewUrl} … />` with a "Remove GIF" icon button (`X`) calling `setGif(null)`;
- next to the Add button, when GIFs can be attached: a `GIF` outline button opening `<GifPicker open={picking} onOpenChange={setPicking} onPick={setGif} />`;
- the Add button is disabled when `sending || (content.trim() === '' && gif === null)`.

`card-editor.tsx`:
- `const [gif, setGif] = useState<PickedGif | null>(card.gif);` (a `CardGif` has `id` and `previewUrl`);
- `save` sends `{ content: content.trim() === '' ? null : content.trim(), gif_id: gif?.id ?? null }`;
- same GIF preview / remove / picker controls as the composer;
- Save disabled when `isSaving || (content.trim() === '' && gif === null)`.

- [ ] **Step 4: Translations**

| key | fr | es | de |
|---|---|---|---|
| GIF | GIF | GIF | GIF |
| Choose a GIF | Choisir un GIF | Elegir un GIF | GIF auswählen |
| Search GIFs… | Rechercher des GIF… | Buscar GIF… | GIFs suchen… |
| Remove GIF | Retirer le GIF | Quitar el GIF | GIF entfernen |
| No GIFs found. | Aucun GIF trouvé. | No se encontraron GIF. | Keine GIFs gefunden. |
| Powered by :provider | Fourni par :provider | Con la tecnología de :provider | Bereitgestellt von :provider |
| Too many searches, wait a moment. | Trop de recherches, patientez un instant. | Demasiadas búsquedas, espera un momento. | Zu viele Suchen, warte einen Moment. |

- [ ] **Step 5: Verify and commit**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check` → clean; translation test PASS.
Manual (with `SKRUM_GIF_PROVIDER`/`SKRUM_GIF_API_KEY` set in `.env`): search, attach, GIF-only card, remove GIF from a card with text; the browser's network panel shows only requests to the Skrum origin for GIF images.

```bash
git add resources/js lang
git commit -m "feat: search and attach gifs to cards"
```

---

### Task 10: Whisper transport and live cursors (mouse, touch, pen)

**Files:**
- Modify: `config/reverb.php`, `.env.example`
- Modify: `resources/js/lib/retro/whisper-transport.ts`
- Create: `resources/js/hooks/use-local-preference.ts`, `resources/js/components/retro/live-cursor-layer.tsx`
- Modify: `resources/js/components/retro/board.tsx`, `board-header.tsx`, `lang/*.json`
- Test: create `tests/Feature/Retros/ReverbConfigTest.php`

**Interfaces:**
- Consumes: Task 6 `ctx.presence`, `ctx.online`, `retro.cursorsEnabled`, `retro.isAnonymous`.
- Produces: `whisperTransport(channel: WhisperChannel, event: string, accept: (senderId: string, raw: unknown) => boolean): { send(message: unknown): void; onMessage(handler: (raw: unknown, senderId?: string) => void): () => void }`; `useLocalPreference(key: string, initial: boolean): [boolean, (value: boolean) => void]`; `LiveCursorLayer({ container })`; preference key `skrum.hideMyCursor`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Retros/ReverbConfigTest.php`:

```php
<?php

it('accepts client events only from channel members', function () {
    expect(config('reverb.apps.apps.0.accept_client_events_from'))->toBe('members');
});
```

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/ReverbConfigTest.php` → FAIL (`none`).

- [ ] **Step 2: Enable member client events**

`config/reverb.php`: `'accept_client_events_from' => 'members',` (Reverb then rejects whispers from non-members and adds the authenticated presence `user_id` — the participant id — to every client event it relays).

`.env.example`, under the Reverb block:

```dotenv
# Live cursors send about 25 messages per second per participant. If you turn on
# REVERB_APP_RATE_LIMITING_ENABLED, allow at least that many per connection.
```

Run the test again → PASS.

- [ ] **Step 3: Transport**

`resources/js/lib/retro/whisper-transport.ts` (keep the `WhisperChannel` type from Task 6):

```ts
export type WhisperChannel = {
    whisper(event: string, data: unknown): unknown;
    listen(
        event: string,
        callback: (data: unknown, metadata?: { user_id?: string }) => void,
    ): unknown;
    stopListening(event: string, callback?: (...args: never[]) => void): unknown;
};

/**
 * Client events on the presence channel. Reverb (accept_client_events_from
 * = members) stamps each relayed event with the sender's authenticated
 * presence id, so the sender comes from the server, never from the payload.
 */
export function whisperTransport(
    channel: WhisperChannel,
    event: string,
    accept: (senderId: string, raw: unknown) => boolean,
) {
    return {
        send(message: unknown) {
            channel.whisper(event, message);
        },
        onMessage(handler: (raw: unknown, senderId?: string) => void) {
            const listener = (
                data: unknown,
                metadata?: { user_id?: string },
            ) => {
                const senderId = metadata?.user_id;

                if (!senderId || !accept(senderId, data)) {
                    return;
                }

                handler(data, senderId);
            };

            channel.listen(`.client-${event}`, listener);

            return () => {
                channel.stopListening(`.client-${event}`, listener);
            };
        },
    };
}
```

- [ ] **Step 4: Local preference**

`resources/js/hooks/use-local-preference.ts`:

```ts
import { useCallback, useState } from 'react';

export function useLocalPreference(
    key: string,
    initial: boolean,
): [boolean, (value: boolean) => void] {
    const [value, setValue] = useState<boolean>(() => {
        if (typeof window === 'undefined') {
            return initial;
        }

        try {
            const stored = window.localStorage.getItem(key);

            return stored === null ? initial : stored === 'true';
        } catch {
            return initial;
        }
    });

    const update = useCallback(
        (next: boolean) => {
            try {
                window.localStorage.setItem(key, String(next));
            } catch {
                // Storage can be full or disabled; keep the choice for this page only.
            }

            setValue(next);
        },
        [key],
    );

    return [value, update];
}
```

- [ ] **Step 5: Cursor layer**

`resources/js/components/retro/live-cursor-layer.tsx`:

```tsx
import {
    elementSpace,
    leaveMessage,
    moveMessage,
    type RemoteCursor,
} from 'live-cursors';
import { LiveCursors, useCursors } from 'live-cursors/react';
import { MousePointer2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTrans } from '@/hooks/use-trans';
import { whisperTransport, type WhisperChannel } from '@/lib/retro/whisper-transport';
import { useBoard } from './board-context';

export const HideMyCursorKey = 'skrum.hideMyCursor';

const ThrottleMs = 40;

type LayerProps = { container: HTMLElement | null; hidden: boolean };

export function LiveCursorLayer({ container, hidden }: LayerProps) {
    const { board, presence, online } = useBoard();

    if (!presence || !board.retro.cursorsEnabled || board.retro.phase === 'completed') {
        return null;
    }

    return (
        <Cursors
            presence={presence}
            container={container}
            hidden={hidden}
            onlineIds={online.map((member) => member.id)}
        />
    );
}

function Cursors({
    presence,
    container,
    hidden,
    onlineIds,
}: LayerProps & {
    presence: WhisperChannel;
    onlineIds: string[];
}) {
    const { board, online } = useBoard();
    const { t } = useTrans();
    const roster = useRef(new Set(onlineIds));
    const selfId = board.viewer.participantId;

    roster.current = new Set(onlineIds);

    const transport = useRef(
        whisperTransport(presence, 'cursor', (senderId) => roster.current.has(senderId)),
    );

    const { cursors } = useCursors({
        transport: () => transport.current,
        selfId,
        container,
    });

    useEffect(() => {
        cursors?.setEnabled(!hidden);
    }, [cursors, hidden]);

    useEffect(() => {
        if (!cursors) {
            return;
        }

        for (const cursor of cursors.getSnapshot()) {
            if (!roster.current.has(cursor.id)) {
                cursors.remove(cursor.id);
            }
        }
    }, [cursors, onlineIds]);

    useTouchSender(container, selfId, hidden, transport.current);

    const label = (cursor: RemoteCursor) =>
        board.retro.isAnonymous
            ? t('Participant')
            : (online.find((member) => member.id === cursor.id)?.name ?? t('Participant'));

    return (
        <LiveCursors cursors={cursors}>
            {(cursor, color) =>
                cursor.meta?.p === 'touch' || cursor.meta?.p === 'pen' ? (
                    <span className="flex items-center gap-1">
                        <span
                            className="block size-4 rounded-full border-2 border-white shadow"
                            style={{ backgroundColor: color }}
                        />
                        <span className="lc-label">{label(cursor)}</span>
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
        </LiveCursors>
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
    transport: { send(message: unknown): void },
) {
    useEffect(() => {
        if (!container || hidden) {
            return;
        }

        const space = elementSpace(container);
        let last = 0;
        let pending: ReturnType<typeof setTimeout> | null = null;
        let active = false;

        const send = (event: PointerEvent) => {
            const point = space.toNormalized(event);

            if (point) {
                transport.send(moveMessage(selfId, point.x, point.y, { p: event.pointerType }));
            }

            last = Date.now();
        };

        const onMove = (event: PointerEvent) => {
            if (event.pointerType === 'mouse' || !active) {
                return;
            }

            if (pending) {
                clearTimeout(pending);
            }

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
            if (event.pointerType === 'mouse') {
                return;
            }

            active = false;

            if (pending) {
                clearTimeout(pending);
            }

            transport.send(leaveMessage(selfId));
        };

        container.addEventListener('pointerdown', onDown);
        container.addEventListener('pointermove', onMove);
        container.addEventListener('pointerup', onUp);
        container.addEventListener('pointercancel', onUp);

        return () => {
            if (pending) {
                clearTimeout(pending);
            }

            container.removeEventListener('pointerdown', onDown);
            container.removeEventListener('pointermove', onMove);
            container.removeEventListener('pointerup', onUp);
            container.removeEventListener('pointercancel', onUp);
        };
    }, [container, selfId, hidden, transport]);
}
```

(`useCursors` creates its instance once on mount with the transport factory — the transport is kept in a ref so the roster check reads the latest members. Hidden cursors: `setEnabled(false)` stops sending and sends a leave; others' cursors keep showing.)

`board.tsx`: give the `<main>` a ref through state — `const [boardElement, setBoardElement] = useState<HTMLElement | null>(null);` and `<main ref={setBoardElement} className="relative flex min-w-0 …">` (add `relative`); own the preference once — `const [hideMyCursor, setHideMyCursor] = useLocalPreference(HideMyCursorKey, false);` — and render `<LiveCursorLayer container={boardElement} hidden={hideMyCursor} />` as the last child of `<main>`.

- [ ] **Step 6: "Hide my cursor" switch**

`BoardHeader` gains props `hideMyCursor: boolean` and `onHideMyCursorChange: (hidden: boolean) => void`, passed from `board.tsx`. Next to `<PresenceStrip>`, when `board.retro.cursorsEnabled` (with `const setHideMyCursor = onHideMyCursorChange;`):

```tsx
<Button
    size="icon"
    variant="ghost"
    aria-pressed={hideMyCursor}
    aria-label={hideMyCursor ? t('Show my cursor') : t('Hide my cursor')}
    onClick={() => setHideMyCursor(!hideMyCursor)}
>
    {hideMyCursor ? <MousePointerBan className="size-4" /> : <MousePointer2 className="size-4" />}
</Button>
```

(The board page has no user menu, so the switch sits in the board header. Icons `MousePointer2`, `MousePointerBan` from lucide — if `MousePointerBan` is missing in the installed lucide version, use `EyeOff`.)

- [ ] **Step 7: Translations**

| key | fr | es | de |
|---|---|---|---|
| Participant | Participant | Participante | Teilnehmer |
| Hide my cursor | Masquer mon curseur | Ocultar mi cursor | Meinen Cursor ausblenden |
| Show my cursor | Afficher mon curseur | Mostrar mi cursor | Meinen Cursor anzeigen |

- [ ] **Step 8: Verify and commit**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/ReverbConfigTest.php tests/Feature/TranslationKeysTest.php` → PASS; `npm run types:check && npm run check` → clean.
Restart Reverb so it reads the new config: `vendor/bin/sail restart` (or the Reverb process of `composer run dev`).
Manual (two browsers, one with touch emulation in devtools): mouse cursor appears in the other browser, follows board scrolling, disappears on window blur and after 3 s idle; touch shows a dot only while pressing; "Hide my cursor" stops yours; anonymous retro labels read "Participant".

```bash
git add config .env.example resources/js lang tests
git commit -m "feat: show live cursors for mouse, touch and pen"
```

---

### Task 11: Flying reactions

**Files:**
- Create: `resources/js/components/retro/flying-reactions.tsx`
- Modify: `resources/js/components/retro/board.tsx`, `presence-strip.tsx`, `lang/*.json`

**Interfaces:**
- Consumes: Task 6 `ctx.presence`, `ctx.online`, `retro.reactionsEnabled`; Task 7 `EmojiPicker`, `QuickEmoji`, `isSingleEmoji`; Task 10 `whisperTransport`.
- Produces: `FlyingReactions()` — bottom-centre bar plus overlay; presence avatars carry `data-presence-id`.

- [ ] **Step 1: Presence anchors**

`presence-strip.tsx`: add `data-presence-id={member.id}` to each avatar `<img>`.

- [ ] **Step 2: Component**

`resources/js/components/retro/flying-reactions.tsx`:

```tsx
import { tokenBucket, type TokenBucket } from 'live-reactions';
import { LiveReactions, useReactions } from 'live-reactions/react';
import { SmilePlus } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { QuickEmoji, isSingleEmoji } from '@/lib/retro/emoji';
import { whisperTransport, type WhisperChannel } from '@/lib/retro/whisper-transport';
import { useBoard } from './board-context';
import { EmojiPicker } from './emoji-picker';

const ReceiveLimit = { burst: 5, perSecond: 2 };

export function FlyingReactions() {
    const { board, presence } = useBoard();

    if (!presence || !board.retro.reactionsEnabled || board.retro.phase === 'completed') {
        return null;
    }

    return <Reactions presence={presence} />;
}

function Reactions({ presence }: { presence: WhisperChannel }) {
    const { board, online } = useBoard();
    const { t } = useTrans();
    const roster = useRef(new Set<string>());
    const buckets = useRef(new Map<string, TokenBucket>());

    roster.current = new Set(online.map((member) => member.id));

    const accept = (senderId: string, raw: unknown): boolean => {
        if (!roster.current.has(senderId)) {
            return false;
        }

        const emoji = (raw as { e?: unknown } | null)?.e;

        if (!isSingleEmoji(emoji)) {
            return false;
        }

        let bucket = buckets.current.get(senderId);

        if (!bucket) {
            bucket = tokenBucket(ReceiveLimit);
            buckets.current.set(senderId, bucket);
        }

        return bucket.take();
    };

    const { reactions, send } = useReactions({
        transport: () => whisperTransport(presence, 'reaction', accept),
        selfId: board.viewer.participantId,
        origin: (senderId) => originOf(senderId),
    });

    return (
        <>
            <LiveReactions
                reactions={reactions}
                label={(reaction) =>
                    board.retro.isAnonymous
                        ? null
                        : online.find((member) => member.id === reaction.senderId)?.name
                }
            />
            <div
                role="toolbar"
                aria-label={t('Reactions')}
                className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background/95 px-2 py-1 shadow-lg"
            >
                {QuickEmoji.map((emoji) => (
                    <Button
                        key={emoji}
                        size="icon"
                        variant="ghost"
                        className="size-9 text-lg"
                        aria-label={t('Send a reaction') + ` ${emoji}`}
                        onClick={() => send(emoji)}
                    >
                        {emoji}
                    </Button>
                ))}
                <EmojiPicker label={t('Send a reaction')} onPick={(emoji) => send(emoji)}>
                    <Button size="icon" variant="ghost" className="size-9">
                        <SmilePlus className="size-4" />
                    </Button>
                </EmojiPicker>
            </div>
        </>
    );
}

function originOf(senderId: string): number {
    const avatar = document.querySelector(`[data-presence-id="${CSS.escape(senderId)}"]`);

    if (!avatar) {
        return 0.4 + Math.random() * 0.2;
    }

    const rect = avatar.getBoundingClientRect();

    return (rect.left + rect.width / 2) / window.innerWidth;
}
```

(`accept` runs inside the transport created once by `useReactions`; it reads refs, so it always sees the current roster. Hidden-overflow avatars — the "+N" beyond 8 — fall back to the centre.)

`board.tsx`: render `<FlyingReactions />` once, inside `BoardProvider`, after the board content (not inside `<main>`, the overlay is fixed).

- [ ] **Step 3: Translations**

| key | fr | es | de |
|---|---|---|---|
| Reactions | Réactions | Reacciones | Reaktionen |
| Send a reaction | Envoyer une réaction | Enviar una reacción | Reaktion senden |

- [ ] **Step 4: Verify and commit**

Run: `npm run types:check && npm run check` → clean; translation test PASS.
Manual (two browsers): quick and picker emoji fly from the sender's avatar in both browsers; the same emoji from both within a moment gathers into a bubble; holding a button stops after ~5 (send limit); with `prefers-reduced-motion` emulated, emoji fade in place; turning "Show reactions" off hides the bar everywhere.

```bash
git add resources/js lang
git commit -m "feat: send flying emoji reactions across the board"
```

---

### Task 12: Presentation mode

**Files:**
- Create: `resources/js/components/retro/presentation-overlay.tsx`
- Modify: `resources/js/components/retro/board.tsx`, `lang/*.json`

**Interfaces:**
- Consumes: Task 6 `retro.presentationMode`, `retro.highlightedCardId`; Tasks 7–9 `CardReactions`, `CardComments`, `CardGif`.
- Produces: `PresentationOverlay()`.

- [ ] **Step 1: Component**

`resources/js/components/retro/presentation-overlay.tsx`:

```tsx
import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import { childrenOf } from '@/lib/retro/board-reducer';
import { useBoard } from './board-context';
import { CardComments } from './card-comments';
import { CardGif } from './card-gif';
import { CardReactions } from './card-reactions';

export function PresentationOverlay() {
    const { board } = useBoard();
    const { t } = useTrans();
    const [dismissedCardId, setDismissedCardId] = useState<string | null>(null);
    const { retro, viewer } = board;
    const card = board.cards.find((candidate) => candidate.id === retro.highlightedCardId);
    const open =
        retro.presentationMode &&
        retro.phase === 'discussing' &&
        card !== undefined &&
        dismissedCardId !== card.id;

    if (!card) {
        return null;
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen && !viewer.isFacilitator) {
                    setDismissedCardId(card.id);
                }
            }}
        >
            <DialogContent aria-describedby={undefined} className="max-w-3xl">
                <DialogTitle className="sr-only">{t('Presentation mode')}</DialogTitle>
                {card.gif && <CardGif gif={card.gif} />}
                {card.content !== null && (
                    <p className="text-2xl break-words whitespace-pre-wrap">{card.content}</p>
                )}
                {childrenOf(board.cards, card.id).map((child) => (
                    <p key={child.id} className="border-l-2 pl-3 text-lg text-muted-foreground">
                        {child.content}
                    </p>
                ))}
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {card.author && <span>{card.author.name}</span>}
                    <span>
                        {t(card.votes === 1 ? ':count vote' : ':count votes', {
                            count: card.votes ?? 0,
                        })}
                    </span>
                </div>
                <CardReactions card={card} />
                <CardComments card={card} />
            </DialogContent>
        </Dialog>
    );
}
```

(A facilitator closes the overlay by clearing or changing the highlight, or by turning presentation mode off; for others, closing only hides it until the highlight changes to another card.)

`board.tsx`: render `<PresentationOverlay />` inside `BoardProvider` next to `<FlyingReactions />`.

- [ ] **Step 2: Translations**

Presentation mode already exists from Task 6. Check `:count vote` / `:count votes` exist (they do, from the card badge) — no new keys.

- [ ] **Step 3: Verify and commit**

Run: `npm run types:check && npm run check` → clean.
Manual: facilitator turns on presentation mode and highlights a card → overlay opens for everyone with GIF, reactions and comments; a participant closes it; a new highlight reopens it.

```bash
git add resources/js
git commit -m "feat: present the discussed card to everyone"
```

---

### Task 13: Verification (controller-driven)

No new feature. Prove the acceptance criteria, fix what breaks (one commit per fix), report.

- [ ] **Step 1: Full checks** — `vendor/bin/sail artisan test --compact`, `vendor/bin/sail bin phpstan analyse --no-progress`, `vendor/bin/sail bin pint --test --format agent` is **not** run (project rule) — instead `vendor/bin/sail bin pint --dirty --format agent` must leave no changes, `npm run types:check`, `npm run check`, `npm run build`.
- [ ] **Step 2: Dependency check** — `git diff main -- package.json composer.json`: only `live-cursors`, `live-reactions`, `frimousse` added; `composer.json` unchanged.
- [ ] **Step 3: Two-browser walkthrough (Sail dev app; one desktop browser, one with touch emulation), spec §10:**
  1. Mouse and touch cursors appear, follow scrolling, disappear on blur, on lift and with "Hide my cursor".
  2. Flying reactions (quick and picker) from both browsers gather into a bubble.
  3. Card reactions with a picker emoji; chip tooltip shows names; anonymous retro shows none.
  4. Threaded replies; notification toast and unread dot; dot survives reload only until read.
  5. GIF search and display; network panel shows no request to giphy.com / tenor.com.
  6. Anonymous retro: "Participant" cursor labels, no names on chips, comments or notification toasts.
  7. Each of the six toggles takes effect live in the other browser.
  8. Close for editing blocks every edit (cards, drag, votes, reactions, comments, action items) and shows the badge; facilitator can still change phase and timer.
  9. Presentation overlay follows the highlight.
  10. Vote totals: visible live during Voting; hidden with "Hide vote counts"; always visible in Discussing.
- [ ] **Step 4: Report** — each acceptance criterion of spec §11 with its evidence (test name or walkthrough step); defects with fix commits; open points below.

---

## Open points (for the user before or during execution)

1. **Spoofing is closed rather than accepted.** Spec §3 accepts that a member can claim another's id. Reverb in `members` mode stamps every relayed client event with the sender's authenticated presence `user_id` (`vendor/laravel/reverb/src/Protocols/Pusher/ClientEvent.php:65-75`) and pusher-js passes it as `metadata.user_id` (`node_modules/pusher-js/src/core/channels/presence_channel.ts:67-71`), so this plan takes the sender from there (Task 10). The roster check stays as specified.
2. **Emoji size limit.** Spec §2 caps `emoji` at 16 bytes, which rejects valid picker emoji such as families (👨‍👩‍👧‍👦 = 25 bytes) and couples with skin tones (~35 bytes). The plan uses 64 bytes. Confirm or ask for a spec update.
3. **frimousse fetches emoji data from `cdn.jsdelivr.net`** (Emojibase) on first open, sending viewer IPs to a third party — the opposite of the GIF proxy's intent. Options: accept, or add a small cached proxy route and pass `emojibaseUrl` (not in the spec, not planned).
4. **Reaction names in the tooltip vs "no participant data" in broadcasts.** Spec §4 asks for names in chip tooltips (unless anonymous) and no participant data in `card.reactions.changed`. The plan broadcasts display names (never participant ids) when the retro is not anonymous, so tooltips stay live; on anonymous retros `names` is always empty.
5. **"User menu" for "Hide my cursor".** The board page has no user menu (`resources/js/components/retro/board-header.tsx`); the switch goes in the board header (Task 10).
6. **Hidden cards in the snapshot** carry `reactions: []`, `commentCount: 0`, `comments: []`, `gif: null` rather than omitting the keys, so the TypeScript shape stays uniform; the redaction is the same.
7. **New `hidden` flag on card payloads.** A GIF-only card has `content: null` like a hidden card; the frontend used `content === null` to mean "hidden", so payloads gain `hidden: bool` (Task 5) and the UI switches to it (Task 6).

## Spec coverage

| Spec section / AC | Task |
|---|---|
| §2 settings columns, AC6 | 1 |
| §2 `cards.gif_id`, nullable content | 5 |
| §2 `card_reactions`, `SingleEmoji` | 3 |
| §2 `card_comments` | 4 |
| §2 local preferences | 6 (read marks), 10 (hide my cursor) |
| §3 transport, identity, abuse, AC1 | 10, 11 |
| §3 live cursors (mouse, touch, pen) | 10 |
| §3 flying reactions | 11 |
| §4 reactions rules and endpoints, AC2 | 3, 7 |
| §4 comments, replies, soft delete, AC3 | 4, 8 |
| §4 notifications, AC4 | 4, 6, 8 |
| §4 snapshot, AC8 | 3, 4, 5 |
| §5 GIFs, AC5 | 5, 9 |
| §6 settings behaviour, AC6 | 1, 6, 10, 11, 12 |
| §7 UI | 6–12 |
| §8 error handling | 6 (423 via `run` toast + refetch), 7–9 (rollback via refetch), 9 (429/502) |
| §9 vote totals, AC7 | 2, 6 |
| §10 testing / walkthrough, AC10 | every task, 13 |
| AC9 translations | every task |
