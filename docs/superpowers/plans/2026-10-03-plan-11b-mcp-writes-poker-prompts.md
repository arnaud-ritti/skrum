# Plan 11b — MCP writes, poker tools and prompts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the MCP contract (without the spec-6 tracker tools): action item, suggestion and own-message writes, own-message deletion, planning-poker read and write tools, the `analyze-retro` and `team-health` prompts, the full catalogue/scope/redaction test sweep, packaging and the walkthrough.

**Architecture:** Builds on Plan 11a's `SkrumTool`, `McpGrant`, `McpContext`, `VisibleTeams` and presenters. Write tools call the same action classes as the web controllers (extracting `UpdateCard`/`DeleteCard` from `CardsController` first); poker tools present through `BuildPokerSnapshot`/`PresentPokerRound` so spec 4's redaction (including anonymous rounds) holds; prompts assemble the read tools' presenter output into a capped, redacted user message and never call an LLM.

**Tech Stack:** Laravel 13 (PHP 8.4), `laravel/mcp`, `laravel/sanctum`, PostgreSQL, Pest.

**Spec:** `docs/superpowers/specs/2026-09-29-mcp-server-design.md` (§5, §6.2 without `poker.sources.list`/`poker.iterations.list`, §6.3 without `poker.game.tasks.import`/`poker.game.task.sync`, §6.4, §6.5, §6.6, §7, §9, §10, §11, §13, §14) and the contract `docs/superpowers/research/qretro/mcp-readme.md`. Builds on Plan 11a (`docs/superpowers/plans/2026-10-03-plan-11a-mcp-foundation.md`).

## Global Constraints

- Work on branch `feat/plan-11-mcp`, created from the HEAD of `feat/plan-10-planning-poker` (Plans 10a/10b implemented, unmerged). Plan 11b continues on the same branch after 11a.
- The only new Composer dependencies are `laravel/mcp` and `laravel/sanctum` (spec §1.4, approved 2026-09-30); no new npm dependency.
- Spec 6 is not built: the four tracker tools are out of scope (spec §6.5 planning note); `McpFeature::Trackers` is never available; 25 tools in total.
- `/mcp` is authenticated only by a Sanctum token in `Authorization: Bearer`; sessions and cookies never authenticate it (`config/sanctum.php`: `guard => []`, `stateful => []`, `expiration => null`, `token_prefix => 'skrum_'`). Missing/invalid → 401 with `WWW-Authenticate: Bearer realm="skrum"`.
- Scopes: `mcp:read` always, `mcp:write` and `mcp:delete` opt-in; `*` never issued. Tools outside the grant's scopes or unavailable features are neither listed nor callable.
- Access = scope ∩ team visibility (`TeamPolicy::view`) ∩ bound team; an invisible resource is reported exactly like a missing one: tool error "Not found.".
- UI parity: every write goes through the same guards and action classes as the web endpoint; every read through the same presenters. No tool re-implements a redaction filter.
- Reads never create participants or poker players; writes that need one create it like opening the board/game (poker players never spectators, existing roles kept).
- Inputs snake_case, outputs camelCase, lists `{items, page, hasMore}` with `limit` (default 20, max 50 unless stated) and `page`; every board, action item and poker game carries an absolute `url`.
- No payload, error or log line contains an email, a retro guest token or guest URL, a guest secret, or a credential; `Authorization` headers are excluded from exception context.
- Config `config/skrum.php` → `mcp.enabled` (`SKRUM_MCP_ENABLED`, true), `mcp.rate_limit` (`SKRUM_MCP_RATE_LIMIT`, 120/min/token), `mcp.write_rate_limit` (`SKRUM_MCP_WRITE_RATE_LIMIT`, 30/min/token).
- Tool errors are translated (`SetMcpLocale` applies `users.locale`); strings in `lang/{en,fr,es,de}.json` (German "du", French "vous", Spanish "tú"), appended; `TranslationKeysTest` green.
- Commands through Sail (`vendor/bin/sail …`), shells prefixed with `export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH";`. Migration prefix `2026_10_04_1000xx`, `up()` only, UUID keys.
- PHP conventions of the repo (constructor promotion, typed, early returns, curly braces, PascalCase constants, array-shape docblocks on presenters); frontend: function components, Wayfinder imports, `npm run types:check && npm run check`.
- Commit messages: Conventional Commits with the committing agent's own Co-Authored-By trailer and `Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS`.

## Review Focus

1. **An MCP write racing the browser** (the facilitator moves the board out of `Discussing` or locks it, or ends the poker game, between the tool call's checks) → the tool re-checks under the same lock as the web endpoint and answers the UI's translated error, never a 500 and never a half-written row. Pinned in Task 2 ("refuses when the board left Discussing or locked under the lock") and Task 5 ("refuses poker writes on a game ended under the lock").
2. **`retro.actions.create` with both `board_id` and `team_id`, neither, or `team_id` of a visible team where the user is only a workspace Admin** → validation error / "Only team members can add action items to this team.", nothing created. Pinned in Task 2 ("requires exactly one of board_id or team_id", "refuses admins who are not team members").
3. **`poker.game.tasks.add` with 50 tasks when the game already has 190** → nothing added, one translated error, no `task.saved` broadcast. Pinned in Task 5 ("adds all tasks or none").
4. **`poker.game.task.reveal` on an anonymous round called by the facilitator** → `round.votes` carry no other player's value, `result.distribution` has all values, the estimate follows the preselection rule. Pinned in Task 5 ("keeps anonymous rounds unnamed when revealing").
5. **A prompt on a board with thousands of long messages** → content stays under 60 000 characters, lowest-voted messages dropped first with a note, still redacted. Pinned in Task 6 ("caps prompt content").

## File map

| Area | Files |
|---|---|
| Shared card actions | `app/Actions/Retros/{UpdateCard,DeleteCard,EnsureCardGif}.php`, `app/Http/Controllers/Retros/CardsController.php` |
| Retro write tools | `app/Mcp/Tools/Retro/{CreateAction,UpdateAction,CompleteAction,PromoteSuggestion,RejectSuggestion,UpdateMessage,DeleteOwnMessage}.php`, `app/Mcp/Concerns/FindsOwnMessage.php` |
| Poker tools | `app/Mcp/Presenters/McpPokerGame.php`, `app/Mcp/Tools/Poker/{ListGames,GetGame,ListTasks,CreateGame,AddTasks,SelectTask,RevealTask}.php` |
| Prompts | `app/Mcp/Prompts/{SkrumPrompt,AnalyzeRetro,TeamHealth,PromptToolFailed}.php` |
| Server registration | `app/Mcp/Servers/SkrumServer.php` (`$tools`, `$prompts`) |
| Packaging & docs | `README.md` |
| Tests | `tests/Pest.php` (`mcpWriter`, `mcpPromptText`, `mcpPromptData`, `mcpContractToolNames`, `mcpToolClass`, `mcpPromptNames`), `tests/Feature/Retros/CardActionsTest.php`, `tests/Feature/Mcp/{ActionItemWriteToolsTest,SuggestionToolsTest,MessageWriteToolsTest,PokerReadToolsTest,PokerWriteToolsTest,PromptsTest,CatalogueTest,McpSweepTest,McpBroadcastsTest,McpWriteLimitTest,McpGrantIsolationTest,McpPackagingTest}.php` |
| Translations | `lang/{en,fr,es,de}.json` |

---

### Task 1: Shared card actions (`UpdateCard`, `DeleteCard`, `EnsureCardGif`)

**Files:**
- Create: `app/Actions/Retros/UpdateCard.php`, `app/Actions/Retros/DeleteCard.php`, `app/Actions/Retros/EnsureCardGif.php`
- Modify: `app/Http/Controllers/Retros/CardsController.php` (`store` uses `EnsureCardGif`; `update`/`destroy` call the actions)
- Test: create `tests/Feature/Retros/CardActionsTest.php`; existing `tests/Feature/Retros/CardsTest.php`, `GroupingTest.php`, `GroupNamesTest.php`, `GifsTest.php` stay green unchanged

**Interfaces:**
- Consumes: `RetroGuard`, `PresentCard::handle(Card, Retro, ?Participant)`, `GifCatalog`, events `CardUpdated`, `OwnCardSaved`, `CardDeleted`, `CardGroupNamed`.
- Produces:
  - `EnsureCardGif::handle(Retro $retro, ?string $gifId): void` — no-op for null; `RetroGuard::gifsEnabled`; 422 `gif_id` "This GIF could not be found." when the catalogue cannot resolve it (the controller's former private `ensureGif`, unchanged).
  - `UpdateCard::handle(Retro $retro, Card $card, Participant $actor, array $changes): Card` — `$changes` holds the validated `content` and/or `gif_id` keys (absent key = unchanged). Same guards as before, in the same order (phase Writing/Grouping → unlocked → author), the gif check, one transaction locking the retro, same two broadcasts. Returns the fresh card with its `retro` relation set to the locked retro (so callers present it without another query).
  - `DeleteCard::handle(Retro $retro, Card $card, Participant $actor): void` — the former `destroy` body, unchanged (children ungrouped to the end of their column, `CardDeleted`, group name cleared via `CardGroupNamed`).
- Behaviour of `PATCH` / `DELETE /retros/{retro}/cards/{card}` is identical (same statuses, messages, payloads, broadcasts).

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Retros/CardActionsTest.php`:

```php
<?php

use App\Actions\Retros\DeleteCard;
use App\Actions\Retros\UpdateCard;
use App\Enums\RetroPhase;
use App\Events\Retros\CardDeleted;
use App\Events\Retros\CardUpdated;
use App\Events\Retros\OwnCardSaved;
use App\Models\Card;
use App\Models\Retro;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Event;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

beforeEach(function () {
    Event::fake();
});

it('updates an own card and broadcasts it like the board endpoint', function () {
    $retro = Retro::factory()->create();
    [, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'content' => 'Old']);

    $updated = app(UpdateCard::class)->handle($retro, $card, $participant, ['content' => 'New']);

    expect($updated->content)->toBe('New')
        ->and($updated->relationLoaded('retro'))->toBeTrue()
        ->and($card->fresh()->content)->toBe('New');

    Event::assertDispatched(CardUpdated::class);
    Event::assertDispatched(OwnCardSaved::class);
});

it('keeps fields that are not in the changes', function () {
    $retro = Retro::factory()->create(['gifs_enabled' => true]);
    [, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'content' => 'Keep', 'gif_id' => 'abc']);

    app(UpdateCard::class)->handle($retro, $card, $participant, ['content' => 'Changed']);

    expect($card->fresh()->gif_id)->toBe('abc');
});

it('refuses to update another participant\'s card', function () {
    $retro = Retro::factory()->create();
    [, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    app(UpdateCard::class)->handle($retro, $card, $participant, ['content' => 'Mine now']);
})->throws(AuthorizationException::class, 'You can only change your own cards.');

it('refuses to update a card outside Writing and Grouping', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);

    app(UpdateCard::class)->handle($retro, $card, $participant, ['content' => 'Late']);
})->throws(AuthorizationException::class, 'This action is not available in the current phase.');

it('refuses to update a card on a locked board', function () {
    $retro = Retro::factory()->create(['is_locked' => true]);
    [, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);

    app(UpdateCard::class)->handle($retro, $card, $participant, ['content' => 'Locked']);
})->throws(HttpException::class, 'The board is closed for editing.');

it('refuses to empty a card without a GIF', function () {
    $retro = Retro::factory()->create();
    [, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);

    app(UpdateCard::class)->handle($retro, $card, $participant, ['content' => null]);
})->throws(ValidationException::class);

it('deletes an own card and ungroups its children', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [, $participant] = retroMember($retro);
    $lead = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);
    $child = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $lead->column_id, 'parent_card_id' => $lead->id]);

    app(DeleteCard::class)->handle($retro, $lead, $participant);

    expect(Card::query()->whereKey($lead->id)->exists())->toBeFalse()
        ->and($child->fresh()->parent_card_id)->toBeNull();

    Event::assertDispatched(CardDeleted::class, fn (CardDeleted $event) => $event->cardId === $lead->id);
});

it('refuses to delete another participant\'s card', function () {
    $retro = Retro::factory()->create();
    [, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    app(DeleteCard::class)->handle($retro, $card, $participant);
})->throws(AuthorizationException::class, 'You can only change your own cards.');
```

Before running, open `app/Events/Retros/CardDeleted.php` and use its real public property name for the card id in the `assertDispatched` closure (adjust `cardId` if it differs).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/CardActionsTest.php`
Expected: FAIL — `Class "App\Actions\Retros\UpdateCard" not found`.

- [ ] **Step 3: Create `EnsureCardGif`**

Create `app/Actions/Retros/EnsureCardGif.php`:

```php
<?php

namespace App\Actions\Retros;

use App\Models\Retro;
use App\Support\Gifs\Gif;
use App\Support\Gifs\GifCatalog;
use Illuminate\Validation\ValidationException;

class EnsureCardGif
{
    public function __construct(private GifCatalog $gifCatalog) {}

    public function handle(Retro $retro, ?string $gifId): void
    {
        if ($gifId === null) {
            return;
        }

        RetroGuard::gifsEnabled($retro, $this->gifCatalog);

        $gif = $this->gifCatalog->attempt(
            fn (): ?Gif => $this->gifCatalog->resolve($gifId),
            __('GIF search is unavailable.'),
        );

        if ($gif === null) {
            throw ValidationException::withMessages(['gif_id' => __('This GIF could not be found.')]);
        }
    }
}
```

- [ ] **Step 4: Create `UpdateCard`**

Create `app/Actions/Retros/UpdateCard.php`:

```php
<?php

namespace App\Actions\Retros;

use App\Enums\RetroPhase;
use App\Events\Retros\CardUpdated;
use App\Events\Retros\OwnCardSaved;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Support\Gifs\GifCatalog;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpdateCard
{
    public function __construct(
        private PresentCard $presentCard,
        private GifCatalog $gifCatalog,
        private EnsureCardGif $ensureCardGif,
    ) {}

    /**
     * @param  array{content?: ?string, gif_id?: ?string}  $changes
     */
    public function handle(Retro $retro, Card $card, Participant $actor, array $changes): Card
    {
        RetroGuard::phase($retro, RetroPhase::Writing, RetroPhase::Grouping);
        RetroGuard::unlocked($retro);
        RetroGuard::author($card, $actor);

        if (($changes['gif_id'] ?? null) !== null && $changes['gif_id'] !== $card->gif_id) {
            $this->ensureCardGif->handle($retro, $changes['gif_id']);
        }

        return DB::transaction(function () use ($retro, $card, $actor, $changes): Card {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::phase($locked, RetroPhase::Writing, RetroPhase::Grouping);
            RetroGuard::unlocked($locked);

            $fresh = $locked->cards()->whereKey($card->id)->firstOrFail();

            RetroGuard::author($fresh, $actor);

            $content = array_key_exists('content', $changes) ? $changes['content'] : $fresh->content;
            $gifId = array_key_exists('gif_id', $changes) ? $changes['gif_id'] : $fresh->gif_id;

            if ($gifId !== null && $gifId !== $fresh->gif_id) {
                RetroGuard::gifsEnabled($locked, $this->gifCatalog);
            }

            if ($content === null && $gifId === null) {
                throw ValidationException::withMessages(['content' => __('A card needs text or a GIF.')]);
            }

            $fresh->update(['content' => $content, 'gif_id' => $gifId]);

            (new CardUpdated($locked->id, $this->presentCard->handle($fresh, $locked, null)))->sendToOthers();
            (new OwnCardSaved($locked->id, $actor->id, $this->presentCard->handle($fresh, $locked, $actor)))->sendToOthers();

            return $fresh->setRelation('retro', $locked);
        });
    }
}
```

- [ ] **Step 5: Create `DeleteCard`**

Create `app/Actions/Retros/DeleteCard.php`:

```php
<?php

namespace App\Actions\Retros;

use App\Enums\RetroPhase;
use App\Events\Retros\CardDeleted;
use App\Events\Retros\CardGroupNamed;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Support\Facades\DB;

class DeleteCard
{
    public function __construct(private PresentCard $presentCard) {}

    public function handle(Retro $retro, Card $card, Participant $actor): void
    {
        RetroGuard::phase($retro, RetroPhase::Writing, RetroPhase::Grouping);
        RetroGuard::unlocked($retro);
        RetroGuard::author($card, $actor);

        DB::transaction(function () use ($retro, $card, $actor): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::phase($locked, RetroPhase::Writing, RetroPhase::Grouping);
            RetroGuard::unlocked($locked);

            $card = $locked->cards()->whereKey($card->id)->firstOrFail();

            RetroGuard::author($card, $actor);

            $formerLeadId = $card->parent_card_id;
            $children = $card->children()->orderBy('position')->get();

            $card->delete();

            $ungroupedCards = $children->map(function (Card $child) use ($locked): array {
                $lastPosition = $locked->cards()
                    ->where('column_id', $child->column_id)
                    ->whereNull('parent_card_id')
                    ->max('position');

                $child->parent_card_id = null;
                $child->position = $lastPosition === null ? 0 : $lastPosition + 1;
                $child->save();

                return $this->presentCard->handle($child, $locked, null);
            })->all();

            (new CardDeleted($locked->id, $card->id, $ungroupedCards))->sendToOthers();

            $formerLead = $formerLeadId === null ? null : $locked->cards()->whereKey($formerLeadId)->first();

            if ($formerLead !== null && $formerLead->clearGroupNameWhenEmpty()) {
                (new CardGroupNamed($locked->id, $formerLead->id, null))->sendToOthers();
            }
        });
    }
}
```

- [ ] **Step 6: Point `CardsController` at the actions**

In `app/Http/Controllers/Retros/CardsController.php`:

1. Constructor becomes:

```php
    public function __construct(
        private PresentCard $presentCard,
        private GifCatalog $gifCatalog,
        private EnsureCardGif $ensureCardGif,
        private UpdateCard $updateCard,
        private DeleteCard $deleteCard,
    ) {}
```

2. In `store`, replace `$this->ensureGif($retro, $validated['gif_id'] ?? null);` with `$this->ensureCardGif->handle($retro, $validated['gif_id'] ?? null);`.

3. Replace the whole `update` method with:

```php
    public function update(Request $request, Retro $retro, Card $card): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Writing, RetroPhase::Grouping);
        RetroGuard::unlocked($retro);
        RetroGuard::author($card, $participant);

        $validated = $request->validate([
            'content' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'gif_id' => ['sometimes', 'nullable', 'string', 'max:64', 'regex:/^[A-Za-z0-9_-]+$/'],
        ]);

        $updated = $this->updateCard->handle($retro, $card, $participant, $validated);

        return response()->json(['card' => $this->presentCard->handle($updated, $updated->retro, $participant)]);
    }
```

(The guards stay before validation so an unauthorized request still gets 403 before 422, as today.)

4. Replace the whole `destroy` method with:

```php
    public function destroy(Request $request, Retro $retro, Card $card): Response
    {
        $this->deleteCard->handle($retro, $card, Participant::current($request));

        return response()->noContent();
    }
```

5. Delete the private `ensureGif` method and remove imports that became unused (`CardDeleted`, `CardGroupNamed`, `CardUpdated`, `Gif`, `ValidationException` if nothing else uses them; keep `CardCreated`, `OwnCardSaved`, `DB`, `Rule`). Add `use App\Actions\Retros\DeleteCard;`, `use App\Actions\Retros\EnsureCardGif;`, `use App\Actions\Retros\UpdateCard;`.

- [ ] **Step 7: Run the new and existing card tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/CardActionsTest.php tests/Feature/Retros/CardsTest.php tests/Feature/Retros/GroupingTest.php tests/Feature/Retros/GroupNamesTest.php tests/Feature/Retros/GifsTest.php tests/Feature/Retros/BoardLockTest.php`
Expected: PASS, no existing test modified.

- [ ] **Step 8: Format and analyse**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress`
Expected: clean, 0 errors.

- [ ] **Step 9: Commit**

```bash
git add app/Actions/Retros/UpdateCard.php app/Actions/Retros/DeleteCard.php app/Actions/Retros/EnsureCardGif.php app/Http/Controllers/Retros/CardsController.php tests/Feature/Retros/CardActionsTest.php
git commit -m "refactor: extract card update and delete into shared actions

<Co-Authored-By trailer of the committing model>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

### Task 2: Action item writes (`retro.actions.create`, `retro.actions.update`, `retro.actions.complete`)

**Files:**
- Create: `app/Mcp/Tools/Retro/CreateAction.php`, `app/Mcp/Tools/Retro/UpdateAction.php`, `app/Mcp/Tools/Retro/CompleteAction.php`
- Modify: `app/Mcp/Servers/SkrumServer.php` (register the three tools), `tests/Pest.php` (helper `mcpWriter()`), `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Mcp/ActionItemWriteToolsTest.php`

**Interfaces:**
- Consumes (Plan 11a): `App\Mcp\Tools\SkrumTool` (`requiredScope()`, `run(Request)`; `handle()` maps `ModelNotFoundException` → "Not found.", `AuthorizationException` → its message, 423 → "The board is closed for editing.", `ValidationException` → its messages; write rate limit), `App\Mcp\McpGrant::current()` (`user`), `App\Mcp\McpContext` (`retro(string $id): Retro`, `team(string $id): Team`, `actionItem(string $id): ActionItem`, `participant(Retro): ?Participant`, `participantForWrite(Retro): Participant`), `App\Mcp\Presenters\McpActionItem::handle(ActionItem $item, User $viewer): array` (the spec §6 action item shape with `boardId` and `url`), `App\Enums\McpScope`, Pest `actingAsMcp(User $user, array $scopes = [McpScope::Read], ?Team $team = null)`, `mcpStructured(McpTestResponse $response): array`, `mcpToolNames(PendingTestResponse $pending): array<int, string>`.
- Consumes (repo): `ActionItemRules`, `ResolveActionItemAssignee`, `CreateActionItem`, `ApplyActionItemChanges`, `SetActionItemStatus`, `ActionItemPermissions`, `ActionItemActor`, `WorkspaceActionItemGuard::lockWritable()`, `RetroGuard`, `ActionItemStatus`.
- Produces:
  - Tools `retro.actions.create` (`CreateAction`), `retro.actions.update` (`UpdateAction`), `retro.actions.complete` (`CompleteAction`), scope `mcp:write`, `#[IsReadOnly(false)]`, `#[IsOpenWorld(false)]`; `complete` also `#[IsIdempotent]`.
  - Pest helper `mcpWriter(User $user, ?Team $team = null): PendingTestResponse` (read + write grant), used by Tasks 3–5.

**Rules implemented (spec §6.3, UI parity):**
- `create` with `board_id`: the board's rules — `RetroGuard::phase(Discussing)` + `unlocked` checked before the participant is created, then again under `lockForUpdate` in the transaction; author = the user's participant (`firstOrCreate`); assignee via `ResolveActionItemAssignee` with the retro (member participants normalized to users, guests of this board kept, others refused); `ActionItemRules::create(allowsGuests: true)`.
- `create` with `team_id`: the global page's rules — visible team, `ActionItemPermissions::authorizeCreateWithoutRetro` (team members only), `ActionItemRules::create(allowsGuests: false)` (so `assignee_participant_id` is a validation error), author `ActionItemActor::forUser`, no participant.
- Exactly one of `board_id` / `team_id` (validation error otherwise).
- `update`: workspace surface — `WorkspaceActionItemGuard::lockWritable` (423 while the item's board is locked and not `Completed`), `ApplyActionItemChanges` with `ActionItemActor(user, existing participant of the item's board)`; `status` is not an argument; `assignee_participant_id` (non-null) only for items with a board whose board is in `Discussing` and unlocked (checked on the locked board), always refused for items without a board ("Guests can only be assigned from their own retrospective.").
- `complete`: `SetActionItemStatus` (managers, assignee, review facilitator), workspace surface lock rule; `completed: false` reopens; idempotent.

- [ ] **Step 1: Add the test helper**

Append to `tests/Pest.php` (`mcpStructured()` and `mcpToolNames()` already exist from Plan 11a Task 5):

```php
/**
 * A read + write grant, the common case of the write tool tests.
 */
function mcpWriter(User $user, ?Team $team = null): PendingTestResponse
{
    return actingAsMcp($user, [McpScope::Read, McpScope::Write], $team);
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/Feature/Mcp/ActionItemWriteToolsTest.php`:

```php
<?php

use App\Enums\ActionItemRecurrence;
use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Events\ActionItems\ActionItemCreated;
use App\Events\Retros\ActionItemSaved;
use App\Mcp\Tools\Retro\CompleteAction;
use App\Mcp\Tools\Retro\CreateAction;
use App\Mcp\Tools\Retro\UpdateAction;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('creates an action item on a discussing board as the user\'s participant', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $user = teamMember($retro->team);

    $item = mcpStructured(mcpWriter($user)->tool(CreateAction::class, ['board_id' => $retro->id, 'content' => 'Pair on reviews'])->assertOk());

    $participant = Participant::query()->where('retro_id', $retro->id)->where('user_id', $user->id)->sole();
    $stored = ActionItem::query()->sole();

    expect($item['boardId'])->toBe($retro->id)
        ->and($item['content'])->toBe('Pair on reviews')
        ->and($stored->created_by_participant_id)->toBe($participant->id);

    mcpWriter($user)->tool(CreateAction::class, ['board_id' => $retro->id, 'content' => 'Second'])->assertOk();

    expect(Participant::query()->where('retro_id', $retro->id)->where('user_id', $user->id)->count())->toBe(1);

    Event::assertDispatched(ActionItemCreated::class);
    Event::assertDispatched(ActionItemSaved::class);
});

it('refuses boards outside Discussing without creating a participant', function (RetroPhase $phase) {
    $retro = Retro::factory()->inPhase($phase)->create();
    $user = teamMember($retro->team);

    mcpWriter($user)->tool(CreateAction::class, ['board_id' => $retro->id, 'content' => 'Too early'])
        ->assertHasErrors(['This action is not available in the current phase.']);

    expect(ActionItem::query()->count())->toBe(0)
        ->and(Participant::query()->where('user_id', $user->id)->exists())->toBeFalse();
})->with([RetroPhase::Writing, RetroPhase::Voting, RetroPhase::Completed]);

it('refuses locked boards', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['is_locked' => true]);

    mcpWriter(teamMember($retro->team))->tool(CreateAction::class, ['board_id' => $retro->id, 'content' => 'Locked'])
        ->assertHasErrors(['The board is closed for editing.']);

    expect(ActionItem::query()->count())->toBe(0);
});

it('refuses when the board left Discussing or locked under the lock', function (array $change) {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $user = teamMember($retro->team);
    $flipped = false;

    Retro::retrieved(function (Retro $loaded) use (&$flipped, $retro, $change): void {
        if ($flipped || $loaded->id !== $retro->id) {
            return;
        }

        $flipped = true;
        DB::table('retros')->where('id', $retro->id)->update($change);
    });

    mcpWriter($user)->tool(CreateAction::class, ['board_id' => $retro->id, 'content' => 'Racing'])->assertHasErrors();

    expect(ActionItem::query()->count())->toBe(0);
})->with([
    'moved on' => [['phase' => RetroPhase::Completed->value]],
    'locked' => [['is_locked' => true]],
]);

it('assigns guests of the board and refuses guests of another board', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $user = teamMember($retro->team);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $strangerGuest = Participant::factory()->guest()->create();

    mcpWriter($user)->tool(CreateAction::class, ['board_id' => $retro->id, 'content' => 'Guest task', 'assignee_participant_id' => $guest->id])->assertOk();

    expect(ActionItem::query()->sole()->assignee_participant_id)->toBe($guest->id);

    mcpWriter($user)->tool(CreateAction::class, ['board_id' => $retro->id, 'content' => 'Wrong guest', 'assignee_participant_id' => $strangerGuest->id])
        ->assertHasErrors(['The assignee must be a participant of this retrospective.']);
});

it('stores member participants as their user', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $user = teamMember($retro->team);
    [$colleague, $colleagueParticipant] = retroMember($retro);

    mcpWriter($user)->tool(CreateAction::class, ['board_id' => $retro->id, 'content' => 'Member task', 'assignee_participant_id' => $colleagueParticipant->id])->assertOk();

    $item = ActionItem::query()->sole();

    expect($item->assignee_user_id)->toBe($colleague->id)
        ->and($item->assignee_participant_id)->toBeNull();
});

it('creates items outside a retro for team members in any board phase', function () {
    $team = Team::factory()->create();
    Retro::factory()->inPhase(RetroPhase::Writing)->create(['team_id' => $team->id]);
    $user = teamMember($team);

    $item = mcpStructured(mcpWriter($user)->tool(CreateAction::class, ['team_id' => $team->id, 'content' => 'Team chore', 'assignee_user_id' => $user->id])->assertOk());

    expect($item['boardId'])->toBeNull()
        ->and($item['source'])->toBeNull()
        ->and(ActionItem::query()->sole()->created_by_user_id)->toBe($user->id)
        ->and(Participant::query()->where('user_id', $user->id)->exists())->toBeFalse();
});

it('refuses admins who are not team members', function () {
    $team = Team::factory()->create();

    mcpWriter(workspaceManager($team->workspace))->tool(CreateAction::class, ['team_id' => $team->id, 'content' => 'Not mine'])
        ->assertHasErrors(['Only team members can add action items to this team.']);

    expect(ActionItem::query()->count())->toBe(0);
});

it('refuses guest assignees outside a retro', function () {
    $team = Team::factory()->create();
    $guest = Participant::factory()->guest()->create();

    mcpWriter(teamMember($team))->tool(CreateAction::class, ['team_id' => $team->id, 'content' => 'Guest', 'assignee_participant_id' => $guest->id])
        ->assertHasErrors();

    expect(ActionItem::query()->count())->toBe(0);
});

it('requires exactly one of board_id or team_id', function (array $ids) {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $user = teamMember($retro->team);
    $arguments = collect($ids)->map(fn (string $key): string => $key === 'board_id' ? $retro->id : $retro->team_id)->all();

    mcpWriter($user)->tool(CreateAction::class, [...$arguments, 'content' => 'Ambiguous'])->assertHasErrors();

    expect(ActionItem::query()->count())->toBe(0);
})->with([
    'both' => [['board_id' => 'board_id', 'team_id' => 'team_id']],
    'neither' => [[]],
]);

it('reports boards of other teams as not found', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $outsider = teamMember(Team::factory()->create());

    mcpWriter($outsider)->tool(CreateAction::class, ['board_id' => $retro->id, 'content' => 'Sneaky'])->assertHasErrors(['Not found.']);
    mcpWriter($outsider)->tool(CreateAction::class, ['team_id' => $retro->team_id, 'content' => 'Sneaky'])->assertHasErrors(['Not found.']);
});

it('updates items on the workspace surface and refuses locked running boards', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [$author, $participant] = retroMember($retro);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $participant->id, 'created_by_user_id' => $author->id]);

    mcpWriter($author)->tool(UpdateAction::class, ['action_id' => $item->id, 'content' => 'Reworded'])->assertOk();

    expect($item->fresh()->content)->toBe('Reworded');

    $retro->update(['is_locked' => true]);

    mcpWriter($author)->tool(UpdateAction::class, ['action_id' => $item->id, 'content' => 'Again'])
        ->assertHasErrors(['The board is closed for editing.']);

    $retro->update(['phase' => RetroPhase::Completed]);

    mcpWriter($author)->tool(UpdateAction::class, ['action_id' => $item->id, 'content' => 'After the retro'])->assertOk();
});

it('refuses updates by non-managers', function () {
    $item = ActionItem::factory()->create();

    mcpWriter(teamMember($item->team))->tool(UpdateAction::class, ['action_id' => $item->id, 'content' => 'Hijack'])
        ->assertHasErrors(['Only the author, the facilitator or an admin can change this action item.']);
});

it('assigns guests only while the board is discussing', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [$author, $participant] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $participant->id, 'created_by_user_id' => $author->id]);

    mcpWriter($author)->tool(UpdateAction::class, ['action_id' => $item->id, 'assignee_participant_id' => $guest->id])
        ->assertHasErrors(['This action is not available in the current phase.']);

    $retro->update(['phase' => RetroPhase::Discussing]);

    mcpWriter($author)->tool(UpdateAction::class, ['action_id' => $item->id, 'assignee_participant_id' => $guest->id])->assertOk();

    expect($item->fresh()->assignee_participant_id)->toBe($guest->id);
});

it('refuses guest assignees for items without a board', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->create();
    $guest = Participant::factory()->guest()->create();

    mcpWriter($user)->tool(UpdateAction::class, ['action_id' => $item->id, 'assignee_participant_id' => $guest->id])
        ->assertHasErrors(['Guests can only be assigned from their own retrospective.']);
});

it('sets and clears the recurrence for managers', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->create(['due_on' => now()->addWeek()->toDateString()]);

    mcpWriter($user)->tool(UpdateAction::class, ['action_id' => $item->id, 'recurrence' => ActionItemRecurrence::Weekly->value])->assertOk();

    expect($item->fresh()->recurrence)->toBe(ActionItemRecurrence::Weekly);

    mcpWriter($user)->tool(UpdateAction::class, ['action_id' => $item->id, 'due_on' => null])
        ->assertHasErrors(['A recurring action item needs a due date.']);

    mcpWriter($user)->tool(UpdateAction::class, ['action_id' => $item->id, 'recurrence' => null])->assertOk();

    expect($item->fresh()->recurrence)->toBeNull();
});

it('lets the assignee complete and reopen an item idempotently', function () {
    $team = Team::factory()->create();
    $author = teamMember($team);
    $assignee = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $author)->assignedTo($assignee)->create();

    mcpWriter($assignee)->tool(CompleteAction::class, ['action_id' => $item->id])->assertOk();
    mcpWriter($assignee)->tool(CompleteAction::class, ['action_id' => $item->id, 'completed' => true])->assertOk();

    expect($item->fresh()->completed_at)->not->toBeNull();

    mcpWriter($assignee)->tool(CompleteAction::class, ['action_id' => $item->id, 'completed' => false])->assertOk();

    expect($item->fresh()->completed_at)->toBeNull();
});

it('refuses completion by someone who is neither manager nor assignee', function () {
    $item = ActionItem::factory()->create();

    mcpWriter(teamMember($item->team))->tool(CompleteAction::class, ['action_id' => $item->id])
        ->assertHasErrors(['Only the assignee or a manager can complete this action item.']);
});

it('creates the next occurrence when completing a recurring item', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->recurring(ActionItemRecurrence::Weekly)->create();

    mcpWriter($user)->tool(CompleteAction::class, ['action_id' => $item->id])->assertOk();

    expect(ActionItem::query()->where('previous_occurrence_id', $item->id)->exists())->toBeTrue();
});

it('hides action item tools from read-only tokens', function () {
    $user = teamMember(Team::factory()->create());

    $actionTools = ['retro.actions.create', 'retro.actions.update', 'retro.actions.complete'];

    expect(array_intersect(mcpToolNames(actingAsMcp($user)), $actionTools))->toBe([])
        ->and(mcpToolNames(mcpWriter($user)))->toContain(...$actionTools);
});
```

Check `database/factories/ActionItemFactory.php` before running: `recurring()` must also set a `due_on` (a recurring item needs one); if it does not, pass `['due_on' => now()->addWeek()->toDateString()]` to `create()` in the last recurring test.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/ActionItemWriteToolsTest.php`
Expected: FAIL — `Class "App\Mcp\Tools\Retro\CreateAction" not found`.

- [ ] **Step 4: Implement `CreateAction`**

Create `app/Mcp/Tools/Retro/CreateAction.php`:

```php
<?php

namespace App\Mcp\Tools\Retro;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ActionItemPermissions;
use App\Actions\ActionItems\ActionItemRules;
use App\Actions\ActionItems\CreateActionItem;
use App\Actions\ActionItems\ResolveActionItemAssignee;
use App\Actions\Retros\RetroGuard;
use App\Enums\ActionItemPriority;
use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Mcp\McpContext;
use App\Mcp\McpGrant;
use App\Mcp\Presenters\McpActionItem;
use App\Mcp\Tools\SkrumTool;
use App\Models\ActionItem;
use App\Models\Retro;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\DB;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly(false)]
#[IsOpenWorld(false)]
class CreateAction extends SkrumTool
{
    protected string $name = 'retro.actions.create';

    protected string $description = 'Create an action item (agreement). Pass board_id to add it to a retrospective (only while the board is in the Discussing phase and not locked; the item is created under your name even on anonymous boards), or team_id to add it to a team outside any retrospective. Assign a team member with assignee_user_id, or a guest of that board with assignee_participant_id.';

    public function __construct(
        private McpContext $context,
        private CreateActionItem $createActionItem,
        private ResolveActionItemAssignee $resolveActionItemAssignee,
        private ActionItemPermissions $permissions,
        private McpActionItem $presentActionItem,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'board_id' => $schema->string()->format('uuid')->description('The retrospective to add the item to. Exactly one of board_id or team_id.'),
            'team_id' => $schema->string()->format('uuid')->description('The team to add the item to, outside any retrospective. Exactly one of board_id or team_id.'),
            'content' => $schema->string()->min(1)->max(500)->description('What was agreed.')->required(),
            'priority' => $schema->string()->enum(array_column(ActionItemPriority::cases(), 'value'))->description('Priority, medium by default.'),
            'due_on' => $schema->string()->format('date')->description('Due date, YYYY-MM-DD.'),
            'assignee_user_id' => $schema->string()->format('uuid')->description('A member of the team (see retro.team.members.list).'),
            'assignee_participant_id' => $schema->string()->format('uuid')->description('A guest participant of the board (board_id only).'),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Write;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $target = $request->validate([
            'board_id' => ['required_without:team_id', 'prohibits:team_id', 'nullable', 'uuid'],
            'team_id' => ['required_without:board_id', 'nullable', 'uuid'],
        ]);

        $item = ($target['board_id'] ?? null) !== null
            ? $this->onBoard($request, (string) $target['board_id'])
            : $this->onTeam($request, (string) $target['team_id']);

        return Response::structured($this->presentActionItem->handle($item, McpGrant::current()->user));
    }

    private function onBoard(Request $request, string $boardId): ActionItem
    {
        $validated = $request->validate(ActionItemRules::create(allowsGuests: true), ActionItemRules::messages());
        $retro = $this->context->retro($boardId);

        RetroGuard::phase($retro, RetroPhase::Discussing);
        RetroGuard::unlocked($retro);

        $actor = ActionItemActor::forParticipant($this->context->participantForWrite($retro));

        return DB::transaction(function () use ($retro, $actor, $validated): ActionItem {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::phase($locked, RetroPhase::Discussing);
            RetroGuard::unlocked($locked);

            return $this->createActionItem->handle($locked->team, $locked, $actor, [
                ...ActionItemRules::attributes($validated),
                ...($this->resolveActionItemAssignee->handle($locked->team, $locked, $validated) ?? []),
            ]);
        });
    }

    private function onTeam(Request $request, string $teamId): ActionItem
    {
        $validated = $request->validate(ActionItemRules::create(allowsGuests: false), ActionItemRules::messages());
        $team = $this->context->team($teamId);
        $user = McpGrant::current()->user;

        $this->permissions->authorizeCreateWithoutRetro($user, $team);

        return DB::transaction(fn (): ActionItem => $this->createActionItem->handle($team, null, ActionItemActor::forUser($user), [
            ...ActionItemRules::attributes($validated),
            ...($this->resolveActionItemAssignee->handle($team, null, $validated) ?? []),
        ]));
    }

}
```

If the validator does not accept `prohibits` together with `required_without` for this shape, replace `'prohibits:team_id'` by an explicit check after validation that throws `ValidationException::withMessages(['board_id' => __('Give either board_id or team_id, not both.')])` and add that key to the four lang files.

- [ ] **Step 5: Implement `UpdateAction`**

Create `app/Mcp/Tools/Retro/UpdateAction.php`:

```php
<?php

namespace App\Mcp\Tools\Retro;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ActionItemRules;
use App\Actions\ActionItems\ApplyActionItemChanges;
use App\Actions\ActionItems\WorkspaceActionItemGuard;
use App\Actions\Retros\RetroGuard;
use App\Enums\ActionItemPriority;
use App\Enums\ActionItemRecurrence;
use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Mcp\McpContext;
use App\Mcp\McpGrant;
use App\Mcp\Presenters\McpActionItem;
use App\Mcp\Tools\SkrumTool;
use App\Models\ActionItem;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly(false)]
#[IsOpenWorld(false)]
class UpdateAction extends SkrumTool
{
    protected string $name = 'retro.actions.update';

    protected string $description = 'Update an action item: content, priority, due date, recurrence or assignee. Only its author, the retrospective\'s facilitator or a workspace admin can change it. Guests can be assigned only while the item\'s board is in the Discussing phase. Sub-tasks cannot be changed here.';

    public function __construct(
        private McpContext $context,
        private ApplyActionItemChanges $applyActionItemChanges,
        private McpActionItem $presentActionItem,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'action_id' => $schema->string()->format('uuid')->required(),
            'content' => $schema->string()->min(1)->max(500),
            'priority' => $schema->string()->enum(array_column(ActionItemPriority::cases(), 'value')),
            'due_on' => $schema->string()->format('date')->nullable()->description('YYYY-MM-DD, or null to clear.'),
            'recurrence' => $schema->string()->enum(array_column(ActionItemRecurrence::cases(), 'value'))->nullable()->description('Repeat after completion; needs a due date. Null stops repeating.'),
            'assignee_user_id' => $schema->string()->format('uuid')->nullable()->description('A team member, or null to unassign.'),
            'assignee_participant_id' => $schema->string()->format('uuid')->description('A guest of the item\'s board (board in Discussing only).'),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Write;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = Arr::except($request->validate([
            'action_id' => ['required', 'uuid'],
            ...ActionItemRules::update(allowsGuests: true),
        ], ActionItemRules::messages()), ['action_id', 'status']);

        $item = $this->context->actionItem((string) $request->get('action_id'));
        $actor = new ActionItemActor(McpGrant::current()->user, $item->retro === null ? null : $this->context->participant($item->retro));

        $updated = DB::transaction(function () use ($item, $actor, $validated): ActionItem {
            $locked = WorkspaceActionItemGuard::lockWritable($item->id);

            if (($validated['assignee_participant_id'] ?? null) !== null) {
                $this->ensureGuestAssignable($locked);
            }

            return $this->applyActionItemChanges->handle($locked, $actor, $validated);
        });

        return Response::structured($this->presentActionItem->handle($updated, McpGrant::current()->user));
    }

    /**
     * The UI offers guest assignees only on the board during Discussing.
     */
    private function ensureGuestAssignable(ActionItem $locked): void
    {
        $retro = $locked->retro;

        if ($retro === null) {
            throw ValidationException::withMessages(['assignee_participant_id' => __('Guests can only be assigned from their own retrospective.')]);
        }

        RetroGuard::phase($retro, RetroPhase::Discussing);
        RetroGuard::unlocked($retro);
    }
}
```

- [ ] **Step 6: Implement `CompleteAction`**

Create `app/Mcp/Tools/Retro/CompleteAction.php`:

```php
<?php

namespace App\Mcp\Tools\Retro;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\SetActionItemStatus;
use App\Actions\ActionItems\WorkspaceActionItemGuard;
use App\Enums\ActionItemStatus;
use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\McpGrant;
use App\Mcp\Presenters\McpActionItem;
use App\Mcp\Tools\SkrumTool;
use App\Models\ActionItem;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\DB;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly(false)]
#[IsIdempotent]
#[IsOpenWorld(false)]
class CompleteAction extends SkrumTool
{
    protected string $name = 'retro.actions.complete';

    protected string $description = 'Mark an action item as done (completed: true, the default) or reopen it (completed: false). Allowed for its assignee, its author, the facilitator and workspace admins. Completing a recurring item creates its next occurrence.';

    public function __construct(
        private McpContext $context,
        private SetActionItemStatus $setActionItemStatus,
        private McpActionItem $presentActionItem,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'action_id' => $schema->string()->format('uuid')->required(),
            'completed' => $schema->boolean()->default(true),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Write;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'action_id' => ['required', 'uuid'],
            'completed' => ['sometimes', 'boolean'],
        ]);

        $item = $this->context->actionItem((string) $validated['action_id']);
        $actor = new ActionItemActor(McpGrant::current()->user, $item->retro === null ? null : $this->context->participant($item->retro));
        $status = ($validated['completed'] ?? true) ? ActionItemStatus::Completed : ActionItemStatus::Open;

        $updated = DB::transaction(fn (): ActionItem => $this->setActionItemStatus->handle(WorkspaceActionItemGuard::lockWritable($item->id), $actor, $status));

        return Response::structured($this->presentActionItem->handle($updated, McpGrant::current()->user));
    }
}
```

- [ ] **Step 7: Register the tools**

In `app/Mcp/Servers/SkrumServer.php` add to `$tools` (keep the Plan 11a entries):

```php
        \App\Mcp\Tools\Retro\CreateAction::class,
        \App\Mcp\Tools\Retro\UpdateAction::class,
        \App\Mcp\Tools\Retro\CompleteAction::class,
```

(use `use` imports like the existing entries).

- [ ] **Step 8: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/ActionItemWriteToolsTest.php tests/Feature/ActionItems`
Expected: PASS. If `$schema->string()->format('date')` is rejected by the JsonSchema type (check `vendor/laravel/framework/src/Illuminate/JsonSchema/Types/StringType.php`), keep the description only.

- [ ] **Step 9: Format, analyse, commit**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress && vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`

```bash
git add app/Mcp/Tools/Retro/CreateAction.php app/Mcp/Tools/Retro/UpdateAction.php app/Mcp/Tools/Retro/CompleteAction.php app/Mcp/Servers/SkrumServer.php tests/Pest.php tests/Feature/Mcp/ActionItemWriteToolsTest.php lang
git commit -m "feat: create, update and complete action items through MCP

<Co-Authored-By trailer of the committing model>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

#### Implementer notes
- No new translation key is expected: every message comes from existing actions, guards and `ActionItemRules::messages()`.

### Task 3: Suggestions and own messages (`retro.board.suggested_actions.promote|reject`, `retro.board.messages.update`, `retro.board.messages.delete_own`)

**Files:**
- Create: `app/Mcp/Tools/Retro/PromoteSuggestion.php`, `app/Mcp/Tools/Retro/RejectSuggestion.php`, `app/Mcp/Tools/Retro/UpdateMessage.php`, `app/Mcp/Tools/Retro/DeleteOwnMessage.php`, `app/Mcp/Concerns/FindsOwnMessage.php`
- Modify: `app/Mcp/Servers/SkrumServer.php` (register the four tools)
- Test: create `tests/Feature/Mcp/SuggestionToolsTest.php`, `tests/Feature/Mcp/MessageWriteToolsTest.php`

**Interfaces:**
- Consumes (Plan 11a): `SkrumTool` (`requiredScope()`, `requiredFeature()`, `run()`), `McpFeature::Insights`, `McpContext` (`retro()`, `participant()`, `participantForWrite()`), `McpGrant`, `App\Mcp\Presenters\McpActionItem::handle(ActionItem, User)`, `App\Mcp\Presenters\McpMessage::handle(Card $card, Retro $retro, ?Participant $viewer, ?array $voteTotals): array` (the spec §6.1 Message shape; `$voteTotals` = card id → total, or null while the board hides totals — Plan 11a Task 7), `Retro::showsVoteTotals(): bool` (Plan 11a Task 7), Pest `actingAsMcp()`, `configureLlm()`.
- Consumes (Task 1, Task 2): `UpdateCard`, `DeleteCard`; Pest `mcpWriter()`, `mcpStructured()`.
- Consumes (repo): `PromoteSuggestedAction::handle(Retro $locked, SuggestedAction, Participant): ActionItem`, `RejectSuggestedAction::handle(Retro $locked, SuggestedAction, Participant): void`, `SuggestionGuard::authorize()`, `PresentSuggestedAction::handle()`, `RetroGuard::phase()`.
- Produces:
  - `retro.board.suggested_actions.promote` / `.reject` (scope `mcp:write`, feature `Insights`): participant created (`firstOrCreate`) only once the board is in `Discussing` or `Completed`; then the exact controller flow (guard, transaction locking the retro, fresh suggestion of that retro, action). Promote returns `{suggestedAction, actionItem}`, reject `{suggestedAction}`.
  - `retro.board.messages.update` (scope `mcp:write`): own card only (card of the user's existing participant; otherwise "Not found."), `UpdateCard` with `['content' => …]` (GIF unchanged); returns the message.
  - `retro.board.messages.delete_own` (scope `mcp:delete`, `#[IsDestructive]`): own card only, `DeleteCard`; returns `{deleted: true}`.
  - Trait `App\Mcp\Concerns\FindsOwnMessage` with `ownMessage(McpContext $context, string $messageId): array{0: Card, 1: Retro, 2: Participant}` — throws `ModelNotFoundException` for unknown ids, cards of invisible boards, users without a participant, and others' cards.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Mcp/SuggestionToolsTest.php`:

```php
<?php

use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Enums\SuggestedActionStatus;
use App\Events\Retros\InsightsChanged;
use App\Mcp\Tools\Retro\PromoteSuggestion;
use App\Mcp\Tools\Retro\RejectSuggestion;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\SuggestedAction;
use App\Models\Team;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
    configureLlm();
});

it('hides suggestion tools without an LLM provider', function () {
    config(['services.llm.key' => null]);
    $user = teamMember(Team::factory()->create());

    expect(mcpToolNames(mcpWriter($user)))->not->toContain('retro.board.suggested_actions.promote')->not->toContain('retro.board.suggested_actions.reject');
});

it('offers suggestion tools to write tokens when a provider is configured', function () {
    $user = teamMember(Team::factory()->create());

    expect(mcpToolNames(mcpWriter($user)))->toContain('retro.board.suggested_actions.promote', 'retro.board.suggested_actions.reject')
        ->and(mcpToolNames(actingAsMcp($user)))->not->toContain('retro.board.suggested_actions.promote')->not->toContain('retro.board.suggested_actions.reject');
});

it('promotes a suggestion while discussing, keeping its wording and theme', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $user = teamMember($retro->team);
    $theme = RetroTheme::factory()->create(['retro_id' => $retro->id]);
    $suggestion = SuggestedAction::factory()->create(['retro_id' => $retro->id, 'theme_id' => $theme->id, 'content' => 'Timebox standups']);

    $result = mcpStructured(mcpWriter($user)->tool(PromoteSuggestion::class, ['board_id' => $retro->id, 'suggested_action_id' => $suggestion->id])->assertOk());

    $item = ActionItem::query()->sole();
    $participant = Participant::query()->where('retro_id', $retro->id)->where('user_id', $user->id)->sole();

    expect($item->content)->toBe('Timebox standups')
        ->and($item->theme_id)->toBe($theme->id)
        ->and($item->created_by_participant_id)->toBe($participant->id)
        ->and($suggestion->fresh()->status)->toBe(SuggestedActionStatus::Promoted)
        ->and($suggestion->fresh()->action_item_id)->toBe($item->id)
        ->and($result['suggestedAction']['status'])->toBe('promoted')
        ->and($result['actionItem']['id'])->toBe($item->id);

    Event::assertDispatched(InsightsChanged::class);
});

it('refuses a suggestion that was already handled', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $user = teamMember($retro->team);
    $suggestion = SuggestedAction::factory()->create(['retro_id' => $retro->id]);

    mcpWriter($user)->tool(PromoteSuggestion::class, ['board_id' => $retro->id, 'suggested_action_id' => $suggestion->id])->assertOk();
    mcpWriter($user)->tool(PromoteSuggestion::class, ['board_id' => $retro->id, 'suggested_action_id' => $suggestion->id])
        ->assertHasErrors(['This suggestion was already handled.']);
    mcpWriter($user)->tool(RejectSuggestion::class, ['board_id' => $retro->id, 'suggested_action_id' => $suggestion->id])
        ->assertHasErrors(['This suggestion was already handled.']);

    expect(ActionItem::query()->count())->toBe(1);
});

it('refuses suggestions before Discussing without creating a participant', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    $user = teamMember($retro->team);
    $suggestion = SuggestedAction::factory()->create(['retro_id' => $retro->id]);

    mcpWriter($user)->tool(PromoteSuggestion::class, ['board_id' => $retro->id, 'suggested_action_id' => $suggestion->id])
        ->assertHasErrors(['This action is not available in the current phase.']);

    expect(Participant::query()->where('user_id', $user->id)->exists())->toBeFalse();
});

it('refuses suggestions on a locked discussing board', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['is_locked' => true]);
    $suggestion = SuggestedAction::factory()->create(['retro_id' => $retro->id]);

    mcpWriter(teamMember($retro->team))->tool(RejectSuggestion::class, ['board_id' => $retro->id, 'suggested_action_id' => $suggestion->id])
        ->assertHasErrors(['The board is closed for editing.']);
});

it('lets only the facilitator or a workspace admin handle suggestions once completed', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create(['is_locked' => true]);
    $suggestion = SuggestedAction::factory()->create(['retro_id' => $retro->id]);

    mcpWriter(teamMember($retro->team))->tool(RejectSuggestion::class, ['board_id' => $retro->id, 'suggested_action_id' => $suggestion->id])
        ->assertHasErrors(['Only the facilitator can do this.']);

    mcpWriter(workspaceManager($retro->team->workspace))->tool(RejectSuggestion::class, ['board_id' => $retro->id, 'suggested_action_id' => $suggestion->id])
        ->assertOk();

    expect($suggestion->fresh()->status)->toBe(SuggestedActionStatus::Rejected);
});

it('reports suggestions of another board or team as not found', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $otherRetro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['team_id' => $retro->team_id]);
    $user = teamMember($retro->team);
    $foreign = SuggestedAction::factory()->create(['retro_id' => $otherRetro->id]);
    $invisible = SuggestedAction::factory()->create();

    mcpWriter($user)->tool(PromoteSuggestion::class, ['board_id' => $retro->id, 'suggested_action_id' => $foreign->id])->assertHasErrors(['Not found.']);
    mcpWriter($user)->tool(PromoteSuggestion::class, ['board_id' => $invisible->retro_id, 'suggested_action_id' => $invisible->id])->assertHasErrors(['Not found.']);
});
```

Before running, check `configureLlm()` and how `Llm::isConfigured()` decides (provider, key, model): the first test must make the provider unavailable — adjust the `config([...])` line to what `isConfigured()` reads.

Create `tests/Feature/Mcp/MessageWriteToolsTest.php`:

```php
<?php

use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Events\Retros\CardDeleted;
use App\Events\Retros\CardUpdated;
use App\Mcp\Tools\Retro\DeleteOwnMessage;
use App\Mcp\Tools\Retro\UpdateMessage;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('updates the user\'s own message and broadcasts it', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'content' => 'Old', 'gif_id' => null]);

    $message = mcpStructured(mcpWriter($user)->tool(UpdateMessage::class, ['message_id' => $card->id, 'content' => 'New'])->assertOk());

    expect($message['id'])->toBe($card->id)
        ->and($message['content'])->toBe('New')
        ->and($message['isMine'])->toBeTrue()
        ->and($card->fresh()->content)->toBe('New');

    Event::assertDispatched(CardUpdated::class);
});

it('keeps the GIF of an updated message', function () {
    $retro = Retro::factory()->create(['gifs_enabled' => true]);
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'gif_id' => 'abc']);

    mcpWriter($user)->tool(UpdateMessage::class, ['message_id' => $card->id, 'content' => 'Caption'])->assertOk();

    expect($card->fresh()->gif_id)->toBe('abc');
});

it('reports another participant\'s message as not found', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    mcpWriter($user)->tool(UpdateMessage::class, ['message_id' => $card->id, 'content' => 'Mine'])->assertHasErrors(['Not found.']);
    actingAsMcp($user, [McpScope::Read, McpScope::Delete])->tool(DeleteOwnMessage::class, ['message_id' => $card->id])->assertHasErrors(['Not found.']);

    expect(Card::query()->whereKey($card->id)->exists())->toBeTrue();
});

it('reports messages as not found for users without a participant and never creates one', function () {
    $retro = Retro::factory()->create();
    $user = teamMember($retro->team);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    mcpWriter($user)->tool(UpdateMessage::class, ['message_id' => $card->id, 'content' => 'Mine'])->assertHasErrors(['Not found.']);

    expect(Participant::query()->where('user_id', $user->id)->exists())->toBeFalse();
});

it('reports messages of invisible boards as not found', function () {
    $card = Card::factory()->create();

    mcpWriter(teamMember(Team::factory()->create()))->tool(UpdateMessage::class, ['message_id' => $card->id, 'content' => 'X'])->assertHasErrors(['Not found.']);
});

it('refuses message edits in phases the board refuses', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);

    mcpWriter($user)->tool(UpdateMessage::class, ['message_id' => $card->id, 'content' => 'Late'])
        ->assertHasErrors(['This action is not available in the current phase.']);
});

it('deletes the user\'s own message', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);

    $result = mcpStructured(actingAsMcp($user, [McpScope::Read, McpScope::Delete])->tool(DeleteOwnMessage::class, ['message_id' => $card->id])->assertOk());

    expect($result)->toBe(['deleted' => true])
        ->and(Card::query()->whereKey($card->id)->exists())->toBeFalse();

    Event::assertDispatched(CardDeleted::class);
});

it('keeps update and delete behind their own scopes', function () {
    $user = teamMember(Team::factory()->create());

    expect(mcpToolNames(mcpWriter($user)))->toContain('retro.board.messages.update')->not->toContain('retro.board.messages.delete_own')
        ->and(mcpToolNames(actingAsMcp($user, [McpScope::Read, McpScope::Delete])))->toContain('retro.board.messages.delete_own')->not->toContain('retro.board.messages.update');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/SuggestionToolsTest.php tests/Feature/Mcp/MessageWriteToolsTest.php`
Expected: FAIL — tool classes not found.

- [ ] **Step 3: Implement the own-message lookup**

Create `app/Mcp/Concerns/FindsOwnMessage.php`:

```php
<?php

namespace App\Mcp\Concerns;

use App\Mcp\McpContext;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Database\Eloquent\ModelNotFoundException;

trait FindsOwnMessage
{
    /**
     * Another person's message, or a message on a board the user never
     * joined, does not exist for them.
     *
     * @return array{0: Card, 1: Retro, 2: Participant}
     */
    private function ownMessage(McpContext $context, string $messageId): array
    {
        $card = Card::query()->whereKey($messageId)->first();

        if ($card === null) {
            throw (new ModelNotFoundException)->setModel(Card::class, [$messageId]);
        }

        $retro = $context->retro($card->retro_id);
        $participant = $context->participant($retro);

        if ($participant === null || $card->participant_id !== $participant->id) {
            throw (new ModelNotFoundException)->setModel(Card::class, [$messageId]);
        }

        return [$card, $retro, $participant];
    }
}
```

- [ ] **Step 4: Implement `UpdateMessage` and `DeleteOwnMessage`**

Create `app/Mcp/Tools/Retro/UpdateMessage.php`:

```php
<?php

namespace App\Mcp\Tools\Retro;

use App\Actions\Retros\UpdateCard;
use App\Enums\McpScope;
use App\Mcp\Concerns\FindsOwnMessage;
use App\Mcp\McpContext;
use App\Mcp\Presenters\McpMessage;
use App\Mcp\Tools\SkrumTool;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly(false)]
#[IsOpenWorld(false)]
class UpdateMessage extends SkrumTool
{
    use FindsOwnMessage;

    protected string $name = 'retro.board.messages.update';

    protected string $description = 'Change the text of one of your own messages (cards), while the board still allows editing (Writing or Grouping phase, not locked). Its GIF is kept.';

    public function __construct(
        private McpContext $context,
        private UpdateCard $updateCard,
        private McpMessage $presentMessage,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'message_id' => $schema->string()->format('uuid')->required(),
            'content' => $schema->string()->min(1)->max(1000)->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Write;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'message_id' => ['required', 'uuid'],
            'content' => ['required', 'string', 'max:1000'],
        ]);

        [$card, $retro, $participant] = $this->ownMessage($this->context, (string) $validated['message_id']);

        $updated = $this->updateCard->handle($retro, $card, $participant, ['content' => $validated['content']]);

        $relations = ['participant.user', 'reactions', 'comments'];
        $updated->load([...$relations, 'children' => fn ($query) => $query->with($relations)]);
        $voteTotals = $retro->showsVoteTotals()
            ? $retro->votes()->selectRaw('card_id, count(*) as total')->groupBy('card_id')->pluck('total', 'card_id')->map(fn (mixed $total) => (int) $total)->all()
            : null;

        return Response::structured($this->presentMessage->handle($updated, $retro, $participant, $voteTotals));
    }
}
```

Create `app/Mcp/Tools/Retro/DeleteOwnMessage.php`:

```php
<?php

namespace App\Mcp\Tools\Retro;

use App\Actions\Retros\DeleteCard;
use App\Enums\McpScope;
use App\Mcp\Concerns\FindsOwnMessage;
use App\Mcp\McpContext;
use App\Mcp\Tools\SkrumTool;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;

#[IsDestructive]
#[IsOpenWorld(false)]
class DeleteOwnMessage extends SkrumTool
{
    use FindsOwnMessage;

    protected string $name = 'retro.board.messages.delete_own';

    protected string $description = 'Delete one of your own messages (cards) while the board still allows editing (Writing or Grouping phase, not locked). Cards grouped under it are ungrouped. This cannot be undone.';

    public function __construct(
        private McpContext $context,
        private DeleteCard $deleteCard,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'message_id' => $schema->string()->format('uuid')->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Delete;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate(['message_id' => ['required', 'uuid']]);

        [$card, $retro, $participant] = $this->ownMessage($this->context, (string) $validated['message_id']);

        $this->deleteCard->handle($retro, $card, $participant);

        return Response::structured(['deleted' => true]);
    }
}
```

- [ ] **Step 5: Implement `PromoteSuggestion` and `RejectSuggestion`**

Create `app/Mcp/Tools/Retro/PromoteSuggestion.php`:

```php
<?php

namespace App\Mcp\Tools\Retro;

use App\Actions\Retros\PresentSuggestedAction;
use App\Actions\Retros\PromoteSuggestedAction;
use App\Actions\Retros\RetroGuard;
use App\Actions\Retros\SuggestionGuard;
use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Mcp\McpContext;
use App\Mcp\McpFeature;
use App\Mcp\McpGrant;
use App\Mcp\Presenters\McpActionItem;
use App\Mcp\Tools\SkrumTool;
use App\Models\Retro;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\DB;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly(false)]
#[IsOpenWorld(false)]
class PromoteSuggestion extends SkrumTool
{
    protected string $name = 'retro.board.suggested_actions.promote';

    protected string $description = 'Turn a suggested action of a retrospective into an action item, keeping its wording and theme. While the board is discussing any participant may do it (not while locked); once completed only its facilitator or a workspace admin. Each suggestion can be handled once.';

    public function __construct(
        private McpContext $context,
        private SuggestionGuard $suggestionGuard,
        private PromoteSuggestedAction $promoteSuggestedAction,
        private PresentSuggestedAction $presentSuggestedAction,
        private McpActionItem $presentActionItem,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'board_id' => $schema->string()->format('uuid')->required(),
            'suggested_action_id' => $schema->string()->format('uuid')->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Write;
    }

    protected function requiredFeature(): ?McpFeature
    {
        return McpFeature::Insights;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'board_id' => ['required', 'uuid'],
            'suggested_action_id' => ['required', 'uuid'],
        ]);

        $retro = $this->context->retro((string) $validated['board_id']);
        $retro->suggestedActions()->whereKey($validated['suggested_action_id'])->firstOrFail();

        RetroGuard::phase($retro, RetroPhase::Discussing, RetroPhase::Completed);

        $participant = $this->context->participantForWrite($retro);

        $this->suggestionGuard->authorize($retro, $participant);

        [$suggestion, $actionItem] = DB::transaction(function () use ($retro, $validated, $participant): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();
            $fresh = $locked->suggestedActions()->whereKey($validated['suggested_action_id'])->firstOrFail();

            return [$fresh, $this->promoteSuggestedAction->handle($locked, $fresh, $participant)];
        });

        return Response::structured([
            'suggestedAction' => $this->presentSuggestedAction->handle($suggestion->refresh()),
            'actionItem' => $this->presentActionItem->handle($actionItem, McpGrant::current()->user),
        ]);
    }
}
```

Create `app/Mcp/Tools/Retro/RejectSuggestion.php`:

```php
<?php

namespace App\Mcp\Tools\Retro;

use App\Actions\Retros\PresentSuggestedAction;
use App\Actions\Retros\RejectSuggestedAction;
use App\Actions\Retros\RetroGuard;
use App\Actions\Retros\SuggestionGuard;
use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Mcp\McpContext;
use App\Mcp\McpFeature;
use App\Mcp\Tools\SkrumTool;
use App\Models\Retro;
use App\Models\SuggestedAction;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\DB;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly(false)]
#[IsOpenWorld(false)]
class RejectSuggestion extends SkrumTool
{
    protected string $name = 'retro.board.suggested_actions.reject';

    protected string $description = 'Dismiss a suggested action of a retrospective, with the same rules as promoting it. Each suggestion can be handled once.';

    public function __construct(
        private McpContext $context,
        private SuggestionGuard $suggestionGuard,
        private RejectSuggestedAction $rejectSuggestedAction,
        private PresentSuggestedAction $presentSuggestedAction,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'board_id' => $schema->string()->format('uuid')->required(),
            'suggested_action_id' => $schema->string()->format('uuid')->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Write;
    }

    protected function requiredFeature(): ?McpFeature
    {
        return McpFeature::Insights;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'board_id' => ['required', 'uuid'],
            'suggested_action_id' => ['required', 'uuid'],
        ]);

        $retro = $this->context->retro((string) $validated['board_id']);
        $retro->suggestedActions()->whereKey($validated['suggested_action_id'])->firstOrFail();

        RetroGuard::phase($retro, RetroPhase::Discussing, RetroPhase::Completed);

        $participant = $this->context->participantForWrite($retro);

        $this->suggestionGuard->authorize($retro, $participant);

        $suggestion = DB::transaction(function () use ($retro, $validated, $participant): SuggestedAction {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();
            $fresh = $locked->suggestedActions()->whereKey($validated['suggested_action_id'])->firstOrFail();

            $this->rejectSuggestedAction->handle($locked, $fresh, $participant);

            return $fresh;
        });

        return Response::structured(['suggestedAction' => $this->presentSuggestedAction->handle($suggestion->refresh())]);
    }
}
```

- [ ] **Step 6: Register the tools**

Add `PromoteSuggestion`, `RejectSuggestion`, `UpdateMessage`, `DeleteOwnMessage` to `SkrumServer::$tools`.

- [ ] **Step 7: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/SuggestionToolsTest.php tests/Feature/Mcp/MessageWriteToolsTest.php tests/Feature/Retros/SuggestedActionsTest.php`
Expected: PASS.

- [ ] **Step 8: Format, analyse, commit**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress`

```bash
git add app/Mcp/Concerns/FindsOwnMessage.php app/Mcp/Tools/Retro/PromoteSuggestion.php app/Mcp/Tools/Retro/RejectSuggestion.php app/Mcp/Tools/Retro/UpdateMessage.php app/Mcp/Tools/Retro/DeleteOwnMessage.php app/Mcp/Servers/SkrumServer.php tests/Feature/Mcp/SuggestionToolsTest.php tests/Feature/Mcp/MessageWriteToolsTest.php
git commit -m "feat: handle suggestions and own messages through MCP

<Co-Authored-By trailer of the committing model>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

#### Implementer notes
- The promote/reject flow checks the phase before creating the participant (spec §5: participants are created like opening the board, but a refused call should leave no trace); a refusal in `Completed` by a plain member can still leave the participant row created by `participantForWrite`, exactly as the member would by opening the board.
- `SuggestedActionPromotionsController` and `SuggestedActionsController` are unchanged: the tools repeat their three-line flow around the shared actions instead of extracting another class (the flow is thin and the guard/actions are already shared).

### Task 4: Poker reads (`poker.games.list`, `poker.game.get`, `poker.game.tasks.list`)

**Files:**
- Create: `app/Mcp/Presenters/McpPokerGame.php`, `app/Mcp/Tools/Poker/ListGames.php`, `app/Mcp/Tools/Poker/GetGame.php`, `app/Mcp/Tools/Poker/ListTasks.php`
- Modify: `app/Mcp/Servers/SkrumServer.php` (register the three tools)
- Test: create `tests/Feature/Mcp/PokerReadToolsTest.php`

**Interfaces:**
- Consumes (Plan 11a): `SkrumTool`, `McpScope::Read`, `McpContext` (`team()`, `pokerGame()`, `pokerPlayer(PokerGame): ?PokerPlayer`), `McpGrant::current()->user`, Pest `actingAsMcp()`; Plan 11a Task 5 Pest `mcpStructured()`.
- Consumes (repo, Plan 10): `BuildPokerSnapshot::handle(PokerGame, PokerPlayer)`, `PresentPokerRound::handle(PokerRound, PokerGame, ?string $viewerPlayerId, bool $listUnrevealedVoters = true)`, `PresentPokerTask::handle(PokerTask)`, `PresentPokerGameSummary::withCounts()`, Pest `pokerFacilitator()`, `pokerMember()`, `openPokerRound()`, `pokerVote()`.
- Produces:
  - `McpPokerGame::summary(PokerGame $game): array{id, title, deck, tasksCount, estimatedCount, totalPoints: ?float, endedAt: ?string, createdAt: string, url: string}` (expects `PresentPokerGameSummary::withCounts()` aggregates).
  - `McpPokerGame::game(PokerGame $game, ?PokerPlayer $viewer): array{game, facilitator: ?array{name}, players, currentTask, me}` — the spec §6.2 `poker.game.get` shape, built from `BuildPokerSnapshot` (so spec 4 redaction applies). Without a player row the snapshot is built for an unsaved viewer (`id` null): nobody's value is visible to them before reveal and nothing is created.
  - `McpPokerGame::currentTask(array $snapshot): ?array` — `{id, title, round: {number, anonymous, revealed, revealReason, timerEndsAt, votesCount, voters: [{name, hasVoted}], myVote, result}}`; `voters` = non-spectator players only.
  - `McpPokerGame::tasks(PokerGame $game, ?PokerPlayer $viewer): array` — the `poker.game.tasks.list` items: `{id, title, description, position, isCurrent, estimate, estimatedAt, roundsCount, latestRound: null|{number, anonymous, revealed, revealReason, votes: [{player, value}], result}, external: null}`, values from `PresentPokerRound` (own value only before reveal; never another player's value in an anonymous round).
  - Tools `poker.games.list` (`ListGames`), `poker.game.get` (`GetGame`), `poker.game.tasks.list` (`ListTasks`): scope `mcp:read`, `#[IsReadOnly]`, `#[IsOpenWorld(false)]`. Task 5 reuses `McpPokerGame::game()` and `currentTask()`.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Mcp/PokerReadToolsTest.php`:

```php
<?php

use App\Enums\PokerDeck;
use App\Enums\PokerRevealReason;
use App\Mcp\Tools\Poker\GetGame;
use App\Mcp\Tools\Poker\ListGames;
use App\Mcp\Tools\Poker\ListTasks;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use App\Models\Team;

it('lists the team\'s games newest first with counts and links', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $older = PokerGame::factory()->create(['team_id' => $team->id, 'title' => 'Older', 'created_at' => now()->subDay()]);
    $newer = PokerGame::factory()->create(['team_id' => $team->id, 'title' => 'Newer']);
    PokerTask::factory()->estimated('5')->create(['poker_game_id' => $newer->id]);
    PokerTask::factory()->create(['poker_game_id' => $newer->id]);
    PokerGame::factory()->ended()->create(['team_id' => $team->id, 'title' => 'Done']);

    $result = mcpStructured(actingAsMcp($user)->tool(ListGames::class, ['team_id' => $team->id])->assertOk());

    expect(collect($result['items'])->pluck('title')->all())->toBe(['Newer', 'Older'])
        ->and($result['items'][0])->toMatchArray([
            'id' => $newer->id,
            'deck' => 'fibonacci',
            'tasksCount' => 2,
            'estimatedCount' => 1,
            'totalPoints' => 5,
            'endedAt' => null,
            'url' => route('poker.show', $newer),
        ])
        ->and($result['page'])->toBe(1)
        ->and($result['hasMore'])->toBeFalse();

    $ended = mcpStructured(actingAsMcp($user)->tool(ListGames::class, ['team_id' => $team->id, 'status' => 'ended'])->assertOk());
    $all = mcpStructured(actingAsMcp($user)->tool(ListGames::class, ['team_id' => $team->id, 'status' => 'all'])->assertOk());

    expect(collect($ended['items'])->pluck('title')->all())->toBe(['Done'])
        ->and($all['items'])->toHaveCount(3);
});

it('paginates games', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    PokerGame::factory()->count(3)->create(['team_id' => $team->id]);

    $first = mcpStructured(actingAsMcp($user)->tool(ListGames::class, ['team_id' => $team->id, 'limit' => 2])->assertOk());
    $second = mcpStructured(actingAsMcp($user)->tool(ListGames::class, ['team_id' => $team->id, 'limit' => 2, 'page' => 2])->assertOk());

    expect($first['items'])->toHaveCount(2)
        ->and($first['hasMore'])->toBeTrue()
        ->and($second['items'])->toHaveCount(1)
        ->and($second['hasMore'])->toBeFalse();
});

it('reports games and teams of other teams as not found', function () {
    $game = PokerGame::factory()->create();
    $outsider = teamMember(Team::factory()->create());

    actingAsMcp($outsider)->tool(ListGames::class, ['team_id' => $game->team_id])->assertHasErrors(['Not found.']);
    actingAsMcp($outsider)->tool(GetGame::class, ['game_id' => $game->id])->assertHasErrors(['Not found.']);
    actingAsMcp($outsider)->tool(ListTasks::class, ['game_id' => $game->id])->assertHasErrors(['Not found.']);
});

it('describes a game with the spec 4 fields', function () {
    $game = PokerGame::factory()->create(['deck_name' => 'Team scale', 'deck' => PokerDeck::Custom, 'cards' => ['1', '2', '3', '?'], 'auto_reveal' => true, 'anonymous_votes' => true]);
    [$user, $facilitator] = pokerFacilitator($game);
    $spectator = PokerPlayer::factory()->spectator()->create(['poker_game_id' => $game->id]);
    $round = openPokerRound($game);
    $round->update(['timer_ends_at' => now()->addMinute()]);

    $result = mcpStructured(actingAsMcp($user)->tool(GetGame::class, ['game_id' => $game->id])->assertOk());

    expect($result['game'])->toMatchArray([
        'id' => $game->id,
        'deck' => 'custom',
        'deckLabel' => 'Team scale',
        'cards' => ['1', '2', '3', '?'],
        'autoReveal' => true,
        'anonymousVotes' => true,
        'url' => route('poker.show', $game),
        'guestJoinUrl' => null,
    ])
        ->and($result['facilitator'])->toBe(['name' => $user->name])
        ->and(collect($result['players'])->firstWhere('name', $spectator->displayName())['isSpectator'])->toBeTrue()
        ->and($result['me'])->toBe(['isPlayer' => true, 'isFacilitator' => true, 'isSpectator' => false, 'canEditTasks' => true])
        ->and($result['currentTask']['round'])->toMatchArray([
            'number' => 1,
            'anonymous' => true,
            'revealed' => false,
            'revealReason' => null,
            'votesCount' => 0,
        ])
        ->and($result['currentTask']['round']['timerEndsAt'])->not->toBeNull()
        ->and(collect($result['currentTask']['round']['voters'])->pluck('name')->all())->not->toContain($spectator->displayName());
});

it('hides other players\' values before reveal, for the facilitator too', function () {
    $game = PokerGame::factory()->create();
    [$facilitatorUser, $facilitator] = pokerFacilitator($game);
    [, $member] = pokerMember($game);
    $round = openPokerRound($game);
    pokerVote($round, $facilitator, '5');
    pokerVote($round, $member, '13');

    $game = mcpStructured(actingAsMcp($facilitatorUser)->tool(GetGame::class, ['game_id' => $game->id])->assertOk());
    $tasks = mcpStructured(actingAsMcp($facilitatorUser)->tool(ListTasks::class, ['game_id' => $round->task->poker_game_id])->assertOk());

    expect($game['currentTask']['round']['myVote'])->toBe('5')
        ->and($game['currentTask']['round']['result'])->toBeNull()
        ->and(collect($game['currentTask']['round']['voters'])->every(fn (array $voter): bool => $voter['hasVoted']))->toBeTrue()
        ->and(json_encode($game))->not->toContain('"13"')
        ->and(collect($tasks['items'][0]['latestRound']['votes'])->pluck('value')->filter()->values()->all())->toBe(['5'])
        ->and(json_encode($tasks))->not->toContain('"13"');
});

it('shows named values after reveal and keeps anonymous rounds unnamed', function (bool $anonymous) {
    $game = PokerGame::factory()->create(['anonymous_votes' => $anonymous]);
    [$facilitatorUser, $facilitator] = pokerFacilitator($game);
    [$memberUser, $member] = pokerMember($game);
    $round = openPokerRound($game);
    pokerVote($round, $facilitator, '5');
    pokerVote($round, $member, '13');
    $round->update(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual]);

    $tasks = mcpStructured(actingAsMcp($facilitatorUser)->tool(ListTasks::class, ['game_id' => $game->id])->assertOk());
    $latest = $tasks['items'][0]['latestRound'];
    $memberValue = collect($latest['votes'])->firstWhere('player', $memberUser->name)['value'];

    expect($latest['revealed'])->toBeTrue()
        ->and($latest['revealReason'])->toBe('manual')
        ->and(collect($latest['result']['distribution'])->pluck('value')->all())->toBe(['5', '13'])
        ->and($memberValue)->toBe($anonymous ? null : '13');
})->with(['named' => false, 'anonymous' => true]);

it('returns the guest link only while guest access is on', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    [$user] = pokerMember($game);

    $withGuests = mcpStructured(actingAsMcp($user)->tool(GetGame::class, ['game_id' => $game->id])->assertOk());

    $game->update(['guest_access_enabled' => false]);

    $withoutGuests = mcpStructured(actingAsMcp($user)->tool(GetGame::class, ['game_id' => $game->id])->assertOk());

    expect($withGuests['game']['guestJoinUrl'])->toBe(route('poker.join.show', $game->guest_token))
        ->and($withoutGuests['game']['guestJoinUrl'])->toBeNull();
});

it('never creates a player when reading', function () {
    $game = PokerGame::factory()->create();
    pokerFacilitator($game);
    $round = openPokerRound($game);
    $reader = teamMember($game->team);

    $result = mcpStructured(actingAsMcp($reader)->tool(GetGame::class, ['game_id' => $game->id])->assertOk());
    actingAsMcp($reader)->tool(ListTasks::class, ['game_id' => $game->id])->assertOk();

    expect(PokerPlayer::query()->where('user_id', $reader->id)->exists())->toBeFalse()
        ->and($result['me'])->toBe(['isPlayer' => false, 'isFacilitator' => false, 'isSpectator' => false, 'canEditTasks' => true])
        ->and($result['currentTask']['round']['myVote'])->toBeNull();
});

it('lists tasks in order with the current task and Markdown source', function () {
    $game = PokerGame::factory()->create();
    [$user] = pokerMember($game);
    $first = PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'First', 'description' => '**Bold**']);
    $second = PokerTask::factory()->estimated('8')->create(['poker_game_id' => $game->id, 'title' => 'Second']);
    openPokerRound($game, $second);

    $result = mcpStructured(actingAsMcp($user)->tool(ListTasks::class, ['game_id' => $game->id])->assertOk());

    expect(collect($result['items'])->pluck('title')->all())->toBe(['First', 'Second'])
        ->and($result['items'][0])->toMatchArray(['id' => $first->id, 'description' => '**Bold**', 'isCurrent' => false, 'latestRound' => null, 'roundsCount' => 0, 'external' => null])
        ->and($result['items'][1])->toMatchArray(['isCurrent' => true, 'estimate' => '8', 'roundsCount' => 1]);
});
```

Before running, check the factory states used (`PokerGameFactory::ended()`, `withGuestAccess()`, `PokerPlayerFactory::spectator()`, `PokerTaskFactory::estimated()`): they exist from Plan 10a/10b; adjust only the names if they differ.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/PokerReadToolsTest.php`
Expected: FAIL — tool classes not found.

- [ ] **Step 3: Implement the presenter**

Create `app/Mcp/Presenters/McpPokerGame.php`:

```php
<?php

namespace App\Mcp\Presenters;

use App\Actions\Poker\BuildPokerSnapshot;
use App\Actions\Poker\PresentPokerRound;
use App\Actions\Poker\PresentPokerTask;
use App\Mcp\McpGrant;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;

/**
 * Poker payloads for MCP, always derived from the game's own presenters so
 * spec 4's redaction (unrevealed and anonymous values) holds unchanged.
 */
class McpPokerGame
{
    public function __construct(
        private BuildPokerSnapshot $buildPokerSnapshot,
        private PresentPokerRound $presentPokerRound,
        private PresentPokerTask $presentPokerTask,
    ) {}

    /**
     * @return array{
     *     id: string,
     *     title: string,
     *     deck: string,
     *     tasksCount: int,
     *     estimatedCount: int,
     *     totalPoints: ?float,
     *     endedAt: ?string,
     *     createdAt: string,
     *     url: string
     * }
     */
    public function summary(PokerGame $game): array
    {
        return [
            'id' => $game->id,
            'title' => $game->title,
            'deck' => $game->deck->value,
            'tasksCount' => (int) $game->getAttribute('tasks_count'),
            'estimatedCount' => (int) $game->getAttribute('estimated_tasks_count'),
            'totalPoints' => $game->isNumeric() ? round((float) $game->getAttribute('total_points'), 2) : null,
            'endedAt' => $game->ended_at?->toIso8601String(),
            'createdAt' => $game->created_at?->toIso8601String() ?? '',
            'url' => route('poker.show', $game),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function game(PokerGame $game, ?PokerPlayer $viewer): array
    {
        $snapshot = $this->buildPokerSnapshot->handle($game, $viewer ?? $this->onlooker($game));
        $facilitator = collect($snapshot['players'])->firstWhere('id', $game->facilitator_player_id);

        return [
            'game' => [
                'id' => $game->id,
                'title' => $game->title,
                'deck' => $snapshot['game']['deck'],
                'deckLabel' => $snapshot['game']['deckLabel'],
                'cards' => $snapshot['game']['cards'],
                'isNumeric' => $snapshot['game']['isNumeric'],
                'autoReveal' => $snapshot['game']['autoReveal'],
                'anonymousVotes' => $snapshot['game']['anonymousVotes'],
                'endedAt' => $snapshot['game']['endedAt'],
                'tasksCount' => $snapshot['game']['tasksCount'],
                'estimatedCount' => $snapshot['game']['estimatedCount'],
                'totalPoints' => $snapshot['game']['totalPoints'],
                'url' => route('poker.show', $game),
                'guestJoinUrl' => $snapshot['game']['guestUrl'],
            ],
            'facilitator' => $facilitator === null ? null : ['name' => $facilitator['name']],
            'players' => collect($snapshot['players'])->map(fn (array $player): array => [
                'name' => $player['name'],
                'avatarUrl' => $player['avatarUrl'],
                'isGuest' => $player['isGuest'],
                'isSpectator' => $player['isSpectator'],
            ])->values()->all(),
            'currentTask' => $this->currentTask($snapshot),
            'me' => [
                'isPlayer' => $viewer !== null,
                'isFacilitator' => $viewer !== null && $game->isFacilitator($viewer),
                'isSpectator' => $viewer?->is_spectator ?? false,
                'canEditTasks' => true,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $snapshot  the output of BuildPokerSnapshot
     * @return ?array<string, mixed>
     */
    public function currentTask(array $snapshot): ?array
    {
        if ($snapshot['current'] === null) {
            return null;
        }

        $round = $snapshot['current']['round'];
        $task = collect($snapshot['tasks'])->firstWhere('id', $snapshot['current']['taskId']);
        $voterIds = collect($round['votes'])->pluck('playerId')->flip();

        return [
            'id' => $snapshot['current']['taskId'],
            'title' => $task['title'] ?? '',
            'round' => [
                'number' => $round['number'],
                'anonymous' => $round['anonymous'],
                'revealed' => $round['revealedAt'] !== null,
                'revealReason' => $round['revealReason'],
                'timerEndsAt' => $round['timerEndsAt'],
                'votesCount' => $round['votesCount'],
                'voters' => collect($snapshot['players'])
                    ->reject(fn (array $player): bool => $player['isSpectator'])
                    ->map(fn (array $player): array => ['name' => $player['name'], 'hasVoted' => $voterIds->has($player['id'])])
                    ->values()
                    ->all(),
                'myVote' => $round['myVote'],
                'result' => $round['result'],
            ],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function tasks(PokerGame $game, ?PokerPlayer $viewer): array
    {
        $game->load([
            'players.user',
            'tasks' => fn ($query) => $query->withCount('rounds'),
            'tasks.latestRound.votes',
        ]);

        $names = $game->players->mapWithKeys(fn (PokerPlayer $player): array => [$player->id => $player->displayName()]);

        return $game->tasks->map(function (PokerTask $task) use ($game, $viewer, $names): array {
            $presented = $this->presentPokerTask->handle($task);
            $round = $task->latestRound;
            $latest = $round === null ? null : $this->presentPokerRound->handle($round, $game, $viewer?->id);

            return [
                'id' => $task->id,
                'title' => $presented['title'],
                'description' => $presented['description'],
                'position' => $presented['position'],
                'isCurrent' => $game->current_task_id === $task->id,
                'estimate' => $presented['estimate'],
                'estimatedAt' => $presented['estimatedAt'],
                'roundsCount' => $presented['roundsCount'],
                'latestRound' => $latest === null ? null : [
                    'number' => $latest['number'],
                    'anonymous' => $latest['anonymous'],
                    'revealed' => $latest['revealedAt'] !== null,
                    'revealReason' => $latest['revealReason'],
                    'votes' => collect($latest['votes'])->map(fn (array $vote): array => [
                        'player' => $names[$vote['playerId']] ?? __('Former member'),
                        'value' => $vote['value'],
                    ])->all(),
                    'result' => $latest['result'],
                ],
                'external' => null,
            ];
        })->values()->all();
    }

    /**
     * A team member who never joined reads the game as an unsaved player:
     * no own vote, nothing created.
     */
    private function onlooker(PokerGame $game): PokerPlayer
    {
        $onlooker = new PokerPlayer(['poker_game_id' => $game->id, 'user_id' => McpGrant::current()->user->id]);
        $onlooker->setRelation('user', McpGrant::current()->user);

        return $onlooker;
    }
}
```

- [ ] **Step 4: Implement the tools**

Create `app/Mcp/Tools/Poker/ListGames.php`:

```php
<?php

namespace App\Mcp\Tools\Poker;

use App\Actions\Poker\PresentPokerGameSummary;
use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\Presenters\McpPokerGame;
use App\Mcp\Tools\SkrumTool;
use App\Models\PokerGame;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class ListGames extends SkrumTool
{
    protected string $name = 'poker.games.list';

    protected string $description = 'List a team\'s planning poker games, newest first, with their task, estimate and point counts.';

    public function __construct(
        private McpContext $context,
        private McpPokerGame $presentGame,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'team_id' => $schema->string()->format('uuid')->required(),
            'status' => $schema->string()->enum(['active', 'ended', 'all'])->default('active'),
            'limit' => $schema->integer()->min(1)->max(50)->default(self::DefaultLimit),
            'page' => $schema->integer()->min(1)->default(1),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'team_id' => ['required', 'uuid'],
            'status' => ['sometimes', 'in:active,ended,all'],
            ...$this->paginationRules(),
        ]);

        $team = $this->context->team((string) $validated['team_id']);
        $status = $validated['status'] ?? 'active';
        [$page, $limit] = $this->pagination($validated);

        $query = PresentPokerGameSummary::withCounts(PokerGame::query()->where('team_id', $team->id))
            ->when($status === 'active', fn ($query) => $query->whereNull('ended_at'))
            ->when($status === 'ended', fn ($query) => $query->whereNotNull('ended_at'))
            ->latest('created_at')
            ->latest('id');

        return Response::structured($this->paginate(
            $query,
            $page,
            $limit,
            fn (PokerGame $game): array => $this->presentGame->summary($game),
        ));
    }
}
```

Create `app/Mcp/Tools/Poker/GetGame.php`:

```php
<?php

namespace App\Mcp\Tools\Poker;

use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\Presenters\McpPokerGame;
use App\Mcp\Tools\SkrumTool;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class GetGame extends SkrumTool
{
    protected string $name = 'poker.game.get';

    protected string $description = 'Get a planning poker game: deck, players, the task on the table and its current round. Card values of other players are only shown once the round is revealed, and never with names in an anonymous round.';

    public function __construct(
        private McpContext $context,
        private McpPokerGame $presentGame,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'game_id' => $schema->string()->format('uuid')->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate(['game_id' => ['required', 'uuid']]);

        $game = $this->context->pokerGame((string) $validated['game_id']);

        return Response::structured($this->presentGame->game($game, $this->context->pokerPlayer($game)));
    }
}
```

Create `app/Mcp/Tools/Poker/ListTasks.php`:

```php
<?php

namespace App\Mcp\Tools\Poker;

use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\Presenters\McpPokerGame;
use App\Mcp\Tools\SkrumTool;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class ListTasks extends SkrumTool
{
    protected string $name = 'poker.game.tasks.list';

    protected string $description = 'List the tasks of a planning poker game in order, with their estimate and latest round. Before a round is revealed only who voted is shown (and your own card); in anonymous rounds values appear only in the result distribution.';

    public function __construct(
        private McpContext $context,
        private McpPokerGame $presentGame,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'game_id' => $schema->string()->format('uuid')->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate(['game_id' => ['required', 'uuid']]);

        $game = $this->context->pokerGame((string) $validated['game_id']);

        return Response::structured(['items' => $this->presentGame->tasks($game, $this->context->pokerPlayer($game))]);
    }
}
```

The `ListTasks` test above reads `$tasks['items']`; the spec lists "tasks in order" without naming the wrapper — `items` matches the other list tools.

- [ ] **Step 5: Register the tools**

Add `ListGames`, `GetGame`, `ListTasks` to `SkrumServer::$tools`.

- [ ] **Step 6: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/PokerReadToolsTest.php tests/Feature/Poker/PokerSnapshotTest.php`
Expected: PASS.

- [ ] **Step 7: Format, analyse, commit**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress`

```bash
git add app/Mcp/Presenters/McpPokerGame.php app/Mcp/Tools/Poker app/Mcp/Servers/SkrumServer.php tests/Feature/Mcp/PokerReadToolsTest.php
git commit -m "feat: read planning poker games and tasks through MCP

<Co-Authored-By trailer of the committing model>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

#### Implementer notes
- `BuildPokerSnapshot` computes `me.isFacilitator` and transfer candidates for its viewer; with the unsaved onlooker (`id` null) and a game without facilitator it would think the onlooker facilitates. The MCP payload never forwards the snapshot's `me`: `McpPokerGame::game()` recomputes `me` from the real viewer, so this has no effect on the output.
- `PokerTask::latestRound()` is `hasOne()->orderByDesc('number')` (Plan 10a ruling): eager loading `tasks.latestRound.votes` loads every round of each task and keeps the newest; never use `ofMany`/`withAggregate` on it.

### Task 5: Poker writes (`poker.games.create`, `poker.game.tasks.add`, `poker.game.task.select`, `poker.game.task.reveal`)

**Files:**
- Create: `app/Mcp/Tools/Poker/CreateGame.php`, `app/Mcp/Tools/Poker/AddTasks.php`, `app/Mcp/Tools/Poker/SelectTask.php`, `app/Mcp/Tools/Poker/RevealTask.php`
- Modify: `app/Mcp/Servers/SkrumServer.php` (register the four tools), `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Mcp/PokerWriteToolsTest.php`

**Interfaces:**
- Consumes (Plan 11a): `SkrumTool`, `McpScope::Write`, `McpContext` (`team()`, `pokerGame()`, `pokerPlayerForWrite(PokerGame): PokerPlayer` — creates a non-spectator player, keeps an existing player's role), `McpGrant::current()->user`; Task 2 Pest `mcpWriter()`, Plan 11a Task 5 Pest `mcpStructured()`; Task 4 `McpPokerGame::game(PokerGame, ?PokerPlayer)`.
- Consumes (repo, Plan 10): `CreatePokerGame`, `NewPokerGame`, `PokerDeckRules::{rules, resolve}`, `SavedPokerDeckRules::{ensureExclusive, findForTeam}`, `AddPokerTask` (`MaxTasks = 200`), `SelectPokerTask`, `RevealPokerRound`, `SetPokerEstimate`, `PokerResult::for()`, `PresentPokerRound`, `PokerGuard::{notEnded, facilitator, canEditTasks}`, `PokerRevealReason::Manual`, events `PokerTaskSaved`, `PokerRoundChanged`, `PokerTaskEstimated`.
- Produces:
  - `poker.games.create` (`CreateGame`): same validation as the web form minus `save_deck_as`, `anonymous_votes`, `auto_reveal` (MCP games use the defaults, guest access off); returns the `poker.game.get` shape for the creator (player and facilitator, never spectator).
  - `poker.game.tasks.add` (`AddTasks`): `tasks` 1–50 of `{title 1–200, description? ≤ 10 000}`; one transaction locking the game; `notEnded`, `canEditTasks`; the total must stay ≤ 200 or nothing is added (422 `tasks` "A game can hold at most 200 tasks."); `AddPokerTask` per task in order. Returns `{added, tasks: [{id, title, position}]}`.
  - `poker.game.task.select` (`SelectTask`): facilitator only, game not ended, `task_id` of this game or `null`; returns `{currentTask}` (the `poker.game.get` `currentTask`).
  - `poker.game.task.reveal` (`RevealTask`): facilitator only; `task_id` must be the current task ("This task is not on the table."), its latest round unrevealed ("These cards are already revealed.") with ≥ 1 vote (`RevealPokerRound`: "Nobody has voted yet."); then the estimate the UI would preselect — `nearestCard` for numeric decks, the single `mode` otherwise — through `SetPokerEstimate`; none determined → estimate unchanged, `estimateSet: false`, `reason` "No card could be chosen from the votes.". Returns `{round, estimate, estimateSet, reason}` with `round` from `PresentPokerRound` for the facilitator (anonymous rounds keep other values unnamed).
  - Every poker write re-checks under the game row lock (`lockForUpdate`), exactly like the web controllers, and creates the caller's player inside the same transaction (rolled back on refusal).

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Mcp/PokerWriteToolsTest.php`:

```php
<?php

use App\Enums\PokerDeck;
use App\Enums\PokerRevealReason;
use App\Events\Poker\PokerRoundChanged;
use App\Events\Poker\PokerTaskEstimated;
use App\Events\Poker\PokerTaskSaved;
use App\Mcp\Tools\Poker\AddTasks;
use App\Mcp\Tools\Poker\CreateGame;
use App\Mcp\Tools\Poker\RevealTask;
use App\Mcp\Tools\Poker\SelectTask;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('creates a game with the creator as player and facilitator', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $result = mcpStructured(mcpWriter($user)->tool(CreateGame::class, [
        'team_id' => $team->id,
        'title' => 'Sprint 12',
        'deck' => 'custom',
        'custom_cards' => ['1', '2', '3'],
        'include_coffee' => false,
    ])->assertOk());

    $game = PokerGame::query()->sole();
    $player = PokerPlayer::query()->where('poker_game_id', $game->id)->where('user_id', $user->id)->sole();

    expect($game->cards)->toBe(['1', '2', '3', '?'])
        ->and($game->facilitator_player_id)->toBe($player->id)
        ->and($player->is_spectator)->toBeFalse()
        ->and($game->guest_access_enabled)->toBeFalse()
        ->and($game->auto_reveal)->toBeFalse()
        ->and($game->anonymous_votes)->toBeFalse()
        ->and($result['game']['title'])->toBe('Sprint 12')
        ->and($result['me']['isFacilitator'])->toBeTrue();
});

it('creates a game from a saved deck of the same team only', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $deck = SavedPokerDeck::factory()->create(['team_id' => $team->id, 'name' => 'Team scale', 'cards' => ['1', '2', '5']]);
    $foreignDeck = SavedPokerDeck::factory()->create();

    mcpWriter($user)->tool(CreateGame::class, ['team_id' => $team->id, 'title' => 'Saved', 'deck' => 'custom', 'saved_deck_id' => $deck->id])->assertOk();

    $game = PokerGame::query()->sole();

    expect($game->cards)->toBe(['1', '2', '5'])
        ->and($game->deck_name)->toBe('Team scale');

    mcpWriter($user)->tool(CreateGame::class, ['team_id' => $team->id, 'title' => 'Foreign', 'deck' => 'custom', 'saved_deck_id' => $foreignDeck->id])
        ->assertHasErrors(['Choose a saved deck of this team.']);
    mcpWriter($user)->tool(CreateGame::class, ['team_id' => $team->id, 'title' => 'Both', 'deck' => 'custom', 'saved_deck_id' => $deck->id, 'custom_cards' => ['1', '2']])
        ->assertHasErrors(['Choose either a saved deck or custom cards.']);

    expect(PokerGame::query()->count())->toBe(1);
});

it('validates games like the web form', function () {
    $team = Team::factory()->create();

    mcpWriter(teamMember($team))->tool(CreateGame::class, ['team_id' => $team->id, 'title' => 'Bad', 'deck' => 'custom', 'custom_cards' => ['3', '3']])
        ->assertHasErrors(['Each card can appear only once.']);
    mcpWriter(teamMember(Team::factory()->create()))->tool(CreateGame::class, ['team_id' => $team->id, 'title' => 'Hidden', 'deck' => 'fibonacci'])
        ->assertHasErrors(['Not found.']);

    expect(PokerGame::query()->count())->toBe(0);
});

it('adds tasks in order and creates a player once', function () {
    $game = PokerGame::factory()->create();
    pokerFacilitator($game);
    $user = teamMember($game->team);

    $result = mcpStructured(mcpWriter($user)->tool(AddTasks::class, [
        'game_id' => $game->id,
        'tasks' => [['title' => 'Login page', 'description' => '**Bold**'], ['title' => 'Password reset']],
    ])->assertOk());

    mcpWriter($user)->tool(AddTasks::class, ['game_id' => $game->id, 'tasks' => [['title' => 'Third']]])->assertOk();

    expect($result['added'])->toBe(2)
        ->and(PokerTask::query()->where('poker_game_id', $game->id)->orderBy('position')->pluck('title')->all())->toBe(['Login page', 'Password reset', 'Third'])
        ->and(PokerPlayer::query()->where('poker_game_id', $game->id)->where('user_id', $user->id)->count())->toBe(1)
        ->and(PokerPlayer::query()->where('user_id', $user->id)->sole()->is_spectator)->toBeFalse();

    Event::assertDispatchedTimes(PokerTaskSaved::class, 3);
});

it('keeps an existing spectator role', function () {
    $game = PokerGame::factory()->create();
    $user = teamMember($game->team);
    $spectator = PokerPlayer::factory()->spectator()->create(['poker_game_id' => $game->id, 'user_id' => $user->id]);

    mcpWriter($user)->tool(AddTasks::class, ['game_id' => $game->id, 'tasks' => [['title' => 'Watched']]])->assertOk();

    expect($spectator->fresh()->is_spectator)->toBeTrue();
});

it('adds all tasks or none', function () {
    $game = PokerGame::factory()->create();
    [$user] = pokerFacilitator($game);
    PokerTask::factory()->count(190)->create(['poker_game_id' => $game->id]);

    mcpWriter($user)->tool(AddTasks::class, [
        'game_id' => $game->id,
        'tasks' => collect(range(1, 50))->map(fn (int $n): array => ['title' => "Task {$n}"])->all(),
    ])->assertHasErrors(['A game can hold at most 200 tasks.']);

    expect(PokerTask::query()->where('poker_game_id', $game->id)->count())->toBe(190);

    Event::assertNotDispatched(PokerTaskSaved::class);
});

it('refuses poker writes on an ended game', function () {
    $game = PokerGame::factory()->ended()->create();
    [$user] = pokerFacilitator($game);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id]);

    mcpWriter($user)->tool(AddTasks::class, ['game_id' => $game->id, 'tasks' => [['title' => 'Late']]])->assertHasErrors(['This game has ended.']);
    mcpWriter($user)->tool(SelectTask::class, ['game_id' => $game->id, 'task_id' => $task->id])->assertHasErrors(['This game has ended.']);
});

it('refuses poker writes on a game ended under the lock', function () {
    $game = PokerGame::factory()->create();
    [$user] = pokerFacilitator($game);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id]);
    $flipped = false;

    PokerGame::retrieved(function (PokerGame $loaded) use (&$flipped, $game): void {
        if ($flipped || $loaded->id !== $game->id) {
            return;
        }

        $flipped = true;
        DB::table('poker_games')->where('id', $game->id)->update(['ended_at' => now()]);
    });

    mcpWriter($user)->tool(SelectTask::class, ['game_id' => $game->id, 'task_id' => $task->id])->assertHasErrors(['This game has ended.']);

    expect($game->fresh()->current_task_id)->toBeNull();
});

it('lets only the facilitator select a task, starting round one', function () {
    $game = PokerGame::factory()->create();
    [$facilitator] = pokerFacilitator($game);
    [$member] = pokerMember($game);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Checkout']);

    mcpWriter($member)->tool(SelectTask::class, ['game_id' => $game->id, 'task_id' => $task->id])->assertHasErrors(['Only the facilitator can do this.']);

    $result = mcpStructured(mcpWriter($facilitator)->tool(SelectTask::class, ['game_id' => $game->id, 'task_id' => $task->id])->assertOk());

    expect($game->fresh()->current_task_id)->toBe($task->id)
        ->and($result['currentTask']['title'])->toBe('Checkout')
        ->and($result['currentTask']['round']['number'])->toBe(1);

    mcpWriter($facilitator)->tool(SelectTask::class, ['game_id' => $game->id, 'task_id' => null])->assertOk();

    expect($game->fresh()->current_task_id)->toBeNull();

    Event::assertDispatched(PokerRoundChanged::class);
});

it('reports tasks of another game as not found', function () {
    $game = PokerGame::factory()->create();
    [$facilitator] = pokerFacilitator($game);
    $other = PokerTask::factory()->create(['poker_game_id' => PokerGame::factory()->create(['team_id' => $game->team_id])->id]);

    mcpWriter($facilitator)->tool(SelectTask::class, ['game_id' => $game->id, 'task_id' => $other->id])->assertHasErrors(['Not found.']);
});

it('reveals and stores the nearest card, ties going to the higher card', function () {
    $game = PokerGame::factory()->create();
    [$facilitatorUser, $facilitator] = pokerFacilitator($game);
    [, $member] = pokerMember($game);
    $round = openPokerRound($game);
    pokerVote($round, $facilitator, '3');
    pokerVote($round, $member, '5');

    $result = mcpStructured(mcpWriter($facilitatorUser)->tool(RevealTask::class, ['game_id' => $game->id, 'task_id' => $round->poker_task_id])->assertOk());

    expect($round->fresh()->reveal_reason)->toBe(PokerRevealReason::Manual)
        ->and($round->task->fresh()->estimate)->toBe('5')
        ->and($result)->toMatchArray(['estimate' => '5', 'estimateSet' => true, 'reason' => null])
        ->and($result['round']['result']['average'])->toBe(4);

    Event::assertDispatched(PokerTaskEstimated::class);
});

it('stores the single most played card of a non-numeric deck', function () {
    $game = PokerGame::factory()->deck(PokerDeck::Tshirt)->create();
    [$facilitatorUser, $facilitator] = pokerFacilitator($game);
    [, $member] = pokerMember($game);
    [, $other] = pokerMember($game);
    $round = openPokerRound($game);
    pokerVote($round, $facilitator, 'M');
    pokerVote($round, $member, 'M');
    pokerVote($round, $other, 'L');

    mcpWriter($facilitatorUser)->tool(RevealTask::class, ['game_id' => $game->id, 'task_id' => $round->poker_task_id])->assertOk();

    expect($round->task->fresh()->estimate)->toBe('M');
});

it('leaves the estimate unchanged when no card is determined', function (PokerDeck $deck, array $values) {
    $game = PokerGame::factory()->deck($deck)->create();
    [$facilitatorUser, $facilitator] = pokerFacilitator($game);
    [, $member] = pokerMember($game);
    $round = openPokerRound($game);
    pokerVote($round, $facilitator, $values[0]);
    pokerVote($round, $member, $values[1]);

    $result = mcpStructured(mcpWriter($facilitatorUser)->tool(RevealTask::class, ['game_id' => $game->id, 'task_id' => $round->poker_task_id])->assertOk());

    expect($result['estimateSet'])->toBeFalse()
        ->and($result['estimate'])->toBeNull()
        ->and($result['reason'])->toBe('No card could be chosen from the votes.')
        ->and($round->fresh()->revealed_at)->not->toBeNull();

    Event::assertNotDispatched(PokerTaskEstimated::class);
})->with([
    'tied modes' => [PokerDeck::Tshirt, ['S', 'L']],
    'only special cards' => [PokerDeck::Fibonacci, ['?', '☕']],
]);

it('refuses reveals the table does not allow', function () {
    $game = PokerGame::factory()->create();
    [$facilitatorUser, $facilitator] = pokerFacilitator($game);
    [$memberUser, $member] = pokerMember($game);
    $round = openPokerRound($game);
    $otherTask = PokerTask::factory()->create(['poker_game_id' => $game->id]);

    mcpWriter($facilitatorUser)->tool(RevealTask::class, ['game_id' => $game->id, 'task_id' => $round->poker_task_id])->assertHasErrors(['Nobody has voted yet.']);
    mcpWriter($facilitatorUser)->tool(RevealTask::class, ['game_id' => $game->id, 'task_id' => $otherTask->id])->assertHasErrors(['This task is not on the table.']);

    pokerVote($round, $member, '8');

    mcpWriter($memberUser)->tool(RevealTask::class, ['game_id' => $game->id, 'task_id' => $round->poker_task_id])->assertHasErrors(['Only the facilitator can do this.']);

    $round->update(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::EveryoneVoted]);

    mcpWriter($facilitatorUser)->tool(RevealTask::class, ['game_id' => $game->id, 'task_id' => $round->poker_task_id])->assertHasErrors(['These cards are already revealed.']);
});

it('keeps anonymous rounds unnamed when revealing', function () {
    $game = PokerGame::factory()->create(['anonymous_votes' => true]);
    [$facilitatorUser, $facilitator] = pokerFacilitator($game);
    [, $member] = pokerMember($game);
    $round = openPokerRound($game);
    pokerVote($round, $facilitator, '3');
    pokerVote($round, $member, '13');

    $result = mcpStructured(mcpWriter($facilitatorUser)->tool(RevealTask::class, ['game_id' => $game->id, 'task_id' => $round->poker_task_id])->assertOk());
    $values = collect($result['round']['votes'])->mapWithKeys(fn (array $vote): array => [$vote['playerId'] => $vote['value']])->all();

    expect($values[$member->id])->toBeNull()
        ->and($values[$facilitator->id])->toBe('3')
        ->and(collect($result['round']['result']['distribution'])->pluck('value')->all())->toBe(['3', '13']);
});

it('offers no tool that takes a vote or an estimate value', function () {
    $tools = [CreateGame::class, AddTasks::class, SelectTask::class, RevealTask::class];

    foreach ($tools as $tool) {
        $properties = array_keys(app($tool)->schema(new \Illuminate\JsonSchema\JsonSchemaTypeFactory));

        expect($properties)->not->toContain('value')->not->toContain('estimate')->not->toContain('vote');
    }
});
```

Before running: check `PokerResult::compute` returns `average` as float `4.0` (then `toBe(4)` must become `toBe(4.0)`), and how `JsonSchemaTypeFactory` is constructed (use the concrete class the `Tool::toArray()` of `laravel/mcp` passes to `schema()` — open `vendor/laravel/mcp/src/Server/Tool.php`).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/PokerWriteToolsTest.php`
Expected: FAIL — tool classes not found.

- [ ] **Step 3: Implement `CreateGame`**

Create `app/Mcp/Tools/Poker/CreateGame.php`:

```php
<?php

namespace App\Mcp\Tools\Poker;

use App\Actions\Poker\CreatePokerGame;
use App\Actions\Poker\NewPokerGame;
use App\Actions\Poker\PokerDeckRules;
use App\Actions\Poker\SavedPokerDeckRules;
use App\Enums\McpScope;
use App\Enums\PokerDeck;
use App\Mcp\McpContext;
use App\Mcp\McpGrant;
use App\Mcp\Presenters\McpPokerGame;
use App\Mcp\Tools\SkrumTool;
use App\Models\PokerPlayer;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly(false)]
#[IsOpenWorld(false)]
class CreateGame extends SkrumTool
{
    protected string $name = 'poker.games.create';

    protected string $description = 'Create a planning poker game for a team with a deck (fibonacci, modified_fibonacci, tshirt, powers_of_two, or custom with custom_cards, or a saved deck of the team with saved_deck_id). You become its facilitator. Guest access, auto-reveal and anonymous votes stay off.';

    public function __construct(
        private McpContext $context,
        private CreatePokerGame $createPokerGame,
        private McpPokerGame $presentGame,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'team_id' => $schema->string()->format('uuid')->required(),
            'title' => $schema->string()->min(1)->max(120)->required(),
            'deck' => $schema->string()->enum(array_column(PokerDeck::cases(), 'value'))->required(),
            'custom_cards' => $schema->array()->items($schema->string()->min(1)->max(8))->min(2)->max(20)->description('Cards of a custom deck, in order.'),
            'include_unknown' => $schema->boolean()->default(true)->description('Append the "?" card to a custom deck.'),
            'include_coffee' => $schema->boolean()->default(true)->description('Append the "☕" card to a custom deck.'),
            'saved_deck_id' => $schema->string()->format('uuid')->description('A saved deck of the same team (with deck "custom"); exclusive with custom_cards.'),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Write;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $team = $this->context->team((string) $request->validate(['team_id' => ['required', 'uuid']])['team_id']);

        SavedPokerDeckRules::ensureExclusive($request->all());

        $usesSavedDeck = $request->get('saved_deck_id') !== null;

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            ...($usesSavedDeck
                ? ['deck' => ['required', Rule::in([PokerDeck::Custom->value])], 'saved_deck_id' => ['required', 'string']]
                : PokerDeckRules::rules()),
        ]);

        if ($usesSavedDeck) {
            $savedDeck = SavedPokerDeckRules::findForTeam($team, (string) $validated['saved_deck_id']);
            [$deck, $cards, $deckName] = [PokerDeck::Custom, $savedDeck->cards, $savedDeck->name];
        } else {
            [$deck, $cards] = PokerDeckRules::resolve($validated);
            $deckName = null;
        }

        $game = $this->createPokerGame->handle($team, McpGrant::current()->user, new NewPokerGame(
            title: $validated['title'],
            deck: $deck,
            cards: $cards,
            deckName: $deckName,
        ));

        $player = PokerPlayer::query()->whereKey($game->facilitator_player_id)->firstOrFail();

        return Response::structured($this->presentGame->game($game->fresh() ?? $game, $player));
    }
}
```

- [ ] **Step 4: Implement `AddTasks`**

Create `app/Mcp/Tools/Poker/AddTasks.php`:

```php
<?php

namespace App\Mcp\Tools\Poker;

use App\Actions\Poker\AddPokerTask;
use App\Actions\Poker\PokerGuard;
use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\Tools\SkrumTool;
use App\Models\PokerGame;
use App\Models\PokerTask;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly(false)]
#[IsOpenWorld(false)]
class AddTasks extends SkrumTool
{
    protected string $name = 'poker.game.tasks.add';

    protected string $description = 'Add 1 to 50 tasks (title and optional Markdown description) to the end of a planning poker game, in the given order. A game holds at most 200 tasks: if the batch does not fit, nothing is added.';

    public function __construct(
        private McpContext $context,
        private AddPokerTask $addPokerTask,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'game_id' => $schema->string()->format('uuid')->required(),
            'tasks' => $schema->array()->min(1)->max(50)->items($schema->object([
                'title' => $schema->string()->min(1)->max(200)->required(),
                'description' => $schema->string()->max(10000)->description('Markdown.'),
            ]))->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Write;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'game_id' => ['required', 'uuid'],
            'tasks' => ['required', 'array', 'min:1', 'max:50'],
            'tasks.*.title' => ['required', 'string', 'max:200'],
            'tasks.*.description' => ['nullable', 'string', 'max:10000'],
        ]);

        $game = $this->context->pokerGame((string) $validated['game_id']);

        $tasks = DB::transaction(function () use ($game, $validated): array {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();
            $player = $this->context->pokerPlayerForWrite($locked);

            PokerGuard::notEnded($locked);
            PokerGuard::canEditTasks($player);

            if ($locked->tasks()->count() + count($validated['tasks']) > AddPokerTask::MaxTasks) {
                throw ValidationException::withMessages(['tasks' => __('A game can hold at most 200 tasks.')]);
            }

            return collect($validated['tasks'])
                ->map(fn (array $task): PokerTask => $this->addPokerTask->handle($locked, $task['title'], $task['description'] ?? null))
                ->all();
        });

        return Response::structured([
            'added' => count($tasks),
            'tasks' => collect($tasks)->map(fn (PokerTask $task): array => [
                'id' => $task->id,
                'title' => $task->title,
                'position' => $task->position,
            ])->all(),
        ]);
    }
}
```

- [ ] **Step 5: Implement `SelectTask`**

Create `app/Mcp/Tools/Poker/SelectTask.php`:

```php
<?php

namespace App\Mcp\Tools\Poker;

use App\Actions\Poker\PokerGuard;
use App\Actions\Poker\SelectPokerTask;
use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\Presenters\McpPokerGame;
use App\Mcp\Tools\SkrumTool;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\DB;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly(false)]
#[IsOpenWorld(false)]
class SelectTask extends SkrumTool
{
    protected string $name = 'poker.game.task.select';

    protected string $description = 'Put a task on the table so players can vote on it (facilitator only), or pass task_id null to clear the table. Selecting a task that was never voted on starts its first round.';

    public function __construct(
        private McpContext $context,
        private SelectPokerTask $selectPokerTask,
        private McpPokerGame $presentGame,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'game_id' => $schema->string()->format('uuid')->required(),
            'task_id' => $schema->string()->format('uuid')->nullable()->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Write;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'game_id' => ['required', 'uuid'],
            'task_id' => ['present', 'nullable', 'uuid'],
        ]);

        $game = $this->context->pokerGame((string) $validated['game_id']);

        $player = DB::transaction(function () use ($game, $validated): PokerPlayer {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();
            $player = $this->context->pokerPlayerForWrite($locked);

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);

            $task = $validated['task_id'] === null ? null : $locked->tasks()->whereKey($validated['task_id'])->firstOrFail();

            $this->selectPokerTask->handle($locked, $task);

            return $player;
        });

        $presented = $this->presentGame->game(PokerGame::query()->findOrFail($game->id), $player);

        return Response::structured(['currentTask' => $presented['currentTask']]);
    }
}
```

- [ ] **Step 6: Implement `RevealTask`**

Create `app/Mcp/Tools/Poker/RevealTask.php`:

```php
<?php

namespace App\Mcp\Tools\Poker;

use App\Actions\Poker\PokerGuard;
use App\Actions\Poker\PokerResult;
use App\Actions\Poker\PresentPokerRound;
use App\Actions\Poker\RevealPokerRound;
use App\Actions\Poker\SetPokerEstimate;
use App\Enums\McpScope;
use App\Enums\PokerRevealReason;
use App\Mcp\McpContext;
use App\Mcp\Tools\SkrumTool;
use App\Models\PokerGame;
use App\Models\PokerRound;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly(false)]
#[IsOpenWorld(false)]
class RevealTask extends SkrumTool
{
    protected string $name = 'poker.game.task.reveal';

    protected string $description = 'Reveal the cards of the task on the table (facilitator only) and store the estimate the game would suggest: the card nearest to the average for numeric decks, or the single most played card otherwise. When no card can be chosen the estimate is left unchanged. Votes cannot be cast or estimates set directly.';

    public function __construct(
        private McpContext $context,
        private RevealPokerRound $revealPokerRound,
        private SetPokerEstimate $setPokerEstimate,
        private PresentPokerRound $presentPokerRound,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'game_id' => $schema->string()->format('uuid')->required(),
            'task_id' => $schema->string()->format('uuid')->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Write;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'game_id' => ['required', 'uuid'],
            'task_id' => ['required', 'uuid'],
        ]);

        $game = $this->context->pokerGame((string) $validated['game_id']);

        $result = DB::transaction(function () use ($game, $validated): array {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();
            $player = $this->context->pokerPlayerForWrite($locked);

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);

            $task = $locked->tasks()->whereKey($validated['task_id'])->firstOrFail();

            if ($locked->current_task_id !== $task->id) {
                throw ValidationException::withMessages(['task_id' => __('This task is not on the table.')]);
            }

            $round = $task->latestRound()->lockForUpdate()->first();

            if ($round === null) {
                throw ValidationException::withMessages(['task_id' => __('This task is not on the table.')]);
            }

            if ($round->isRevealed()) {
                throw ValidationException::withMessages(['task_id' => __('These cards are already revealed.')]);
            }

            $this->revealPokerRound->handle($locked, $round, PokerRevealReason::Manual);

            $round->refresh()->load('votes');
            $card = $this->suggestedCard($round, $locked);

            if ($card !== null) {
                $task = $this->setPokerEstimate->handle($locked, $task, $card);
            }

            return [
                'round' => $this->presentPokerRound->handle($round, $locked->load('players'), $player->id),
                'estimate' => $card === null ? $task->estimate : $task->fresh()?->estimate,
                'estimateSet' => $card !== null,
                'reason' => $card === null ? __('No card could be chosen from the votes.') : null,
            ];
        });

        return Response::structured($result);
    }

    /**
     * The card the game preselects after a reveal (spec 4 §3 step 6).
     */
    private function suggestedCard(PokerRound $round, PokerGame $game): ?string
    {
        $result = PokerResult::for($round, $game);

        if ($game->isNumeric()) {
            return $result['nearestCard'];
        }

        return count($result['mode']) === 1 ? $result['mode'][0] : null;
    }
}
```

`estimate` is the task's estimate after the call (unchanged when no card was chosen, possibly `null`).

- [ ] **Step 7: Register the tools and add translations**

Add `CreateGame`, `AddTasks`, `SelectTask`, `RevealTask` to `SkrumServer::$tools`.

Append to `lang/en.json`, `fr.json`, `es.json`, `de.json` (only keys missing at execution time):

| key (en) | fr | es | de |
|---|---|---|---|
| `A game can hold at most 200 tasks.` | `Une partie peut contenir au plus 200 tâches.` | `Una partida puede tener como máximo 200 tareas.` | `Ein Spiel kann höchstens 200 Aufgaben enthalten.` |
| `This task is not on the table.` | `Cette tâche n'est pas sur la table.` | `Esta tarea no está sobre la mesa.` | `Diese Aufgabe liegt nicht auf dem Tisch.` |
| `These cards are already revealed.` | `Ces cartes sont déjà révélées.` | `Estas cartas ya están reveladas.` | `Diese Karten sind bereits aufgedeckt.` |
| `No card could be chosen from the votes.` | `Aucune carte n'a pu être choisie à partir des votes.` | `No se pudo elegir ninguna carta a partir de los votos.` | `Aus den Stimmen ließ sich keine Karte auswählen.` |

(en values equal their keys.)

- [ ] **Step 8: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/PokerWriteToolsTest.php tests/Feature/Mcp/PokerReadToolsTest.php tests/Feature/Poker tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 9: Format, analyse, commit**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress`

```bash
git add app/Mcp/Tools/Poker/CreateGame.php app/Mcp/Tools/Poker/AddTasks.php app/Mcp/Tools/Poker/SelectTask.php app/Mcp/Tools/Poker/RevealTask.php app/Mcp/Servers/SkrumServer.php tests/Feature/Mcp/PokerWriteToolsTest.php lang
git commit -m "feat: create poker games, add tasks, select and reveal through MCP

<Co-Authored-By trailer of the committing model>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

#### Implementer notes
- `pokerPlayerForWrite()` is called inside the transaction before the guards so a refused call rolls the new player row back; an allowed call keeps it (spec §5: created on first write like the game page).
- `SetPokerEstimate::handle()` sends `PokerTaskSaved` and dispatches `PokerTaskEstimated` itself; `RevealPokerRound` sends `PokerRoundChanged`. With no socket id on MCP requests, `sendToOthers()` reaches every open game page.
- The "ended under the lock" test flips `ended_at` in the database after the first `PokerGame` load (`McpContext::pokerGame()`), so only the in-transaction `PokerGuard::notEnded($locked)` can refuse it.
- `PokerResult::for()` computes from the round's loaded votes; the round is refreshed and its votes reloaded after the reveal before computing.

### Task 6: Prompts (`analyze-retro`, `team-health`)

**Files:**
- Create: `app/Mcp/Prompts/SkrumPrompt.php`, `app/Mcp/Prompts/AnalyzeRetro.php`, `app/Mcp/Prompts/TeamHealth.php`, `app/Mcp/Prompts/PromptToolFailed.php`
- Modify: `app/Mcp/Servers/SkrumServer.php` (`$prompts`), `tests/Pest.php` (helpers `mcpPromptText()`, `mcpPromptData()`), `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Mcp/PromptsTest.php`

**Interfaces:**
- Consumes (Plan 11a): `App\Mcp\McpGrant::current()` (`user`, `has(McpScope)`), `App\Enums\McpScope`, `App\Mcp\McpFeature::Insights->isAvailable()`, `App\Mcp\McpContext` (`team(string $id): Team`, `retro(string $id): Retro` — throw `ModelNotFoundException` outside the visible teams), the read tools `App\Mcp\Tools\Retro\{GetSummary, ListInsights, ListBoardActionItems, GetHealth, GetRoti, ListMessages, ListBoards, ListActionItems}` (each `handle(Laravel\Mcp\Request): Response|ResponseFactory`, structured content as spec §6.1), Pest helpers `actingAsMcp(User $user, array $scopes = [McpScope::Read], ?Team $team = null): PendingTestResponse`, `configureLlm()`, `retroMember()`, `teamMember()`.
- Produces: prompts `analyze-retro` (argument `board_id`, required) and `team-health` (argument `team_id`, required), registered on `SkrumServer`; `SkrumPrompt::MaxContentLength = 60000`; `SkrumPrompt::toolData(string $toolClass, array $arguments): array` (throws `PromptToolFailed` with the tool's translated error); Pest helpers `mcpPromptText(McpTestResponse $response): string` and `mcpPromptData(McpTestResponse $response): array` (the JSON block embedded in the prompt).
- Behaviour (spec §7): `mcp:read` only; argument validated against visibility (invisible or missing → error "Not found."); one user message = English instructions + the data as a fenced JSON block, built only from the read tools' structured output (identical redaction); never calls an LLM; answer language from `users.locale` (`en` fallback); content capped at 60 000 characters (analyze-retro drops lowest-voted messages first, team-health drops the oldest boards' recurring themes first) with a note.

- [ ] **Step 1: Test helpers**

Append to `tests/Pest.php` (`Laravel\Mcp\Server\Testing\TestResponse` is already imported there as `McpTestResponse` by Plan 11a Task 5; `TestResponse` in that file is Laravel's HTTP one):

```php
function mcpPromptText(McpTestResponse $response): string
{
    $payload = (fn (): array => $this->response->toArray())->call($response);

    return (string) ($payload['result']['messages'][0]['content']['text'] ?? '');
}

/**
 * @return array<string, mixed>
 */
function mcpPromptData(McpTestResponse $response): array
{
    $text = mcpPromptText($response);

    preg_match('/```json\n(.*)\n```/s', $text, $matches);

    return json_decode($matches[1] ?? 'null', true) ?? [];
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/Feature/Mcp/PromptsTest.php`:

```php
<?php

use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Mcp\Prompts\AnalyzeRetro;
use App\Mcp\Prompts\SkrumPrompt;
use App\Mcp\Prompts\TeamHealth;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\RotiVote;
use App\Models\Team;
use App\Models\User;
use App\Models\Vote;
use Illuminate\Support\Facades\Http;

it('lists both prompts for a read-only token', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $list = actingAsMcp($user)->prompts();

    $names = collect((fn (): array => $this->items)->call($list))->pluck('name')->sort()->values()->all();

    expect($names)->toBe(['analyze-retro', 'team-health']);
});

it('requires a visible board for analyze-retro', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    $foreign = Retro::factory()->create();

    actingAsMcp($user)->prompt(AnalyzeRetro::class, [])->assertHasErrors();
    actingAsMcp($user)->prompt(AnalyzeRetro::class, ['board_id' => 'not-a-uuid'])->assertHasErrors();
    actingAsMcp($user)->prompt(AnalyzeRetro::class, ['board_id' => $foreign->id])->assertHasErrors(['Not found.']);
});

it('embeds the board data with instructions', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['title' => 'Sprint 7 retro']);
    [$user, $participant] = retroMember($retro);
    Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'content' => 'Deploys are slow']);
    ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'content' => 'Automate the release checklist',
        'created_by_participant_id' => $participant->id,
        'created_by_user_id' => $user->id,
    ]);

    $response = actingAsMcp($user)->prompt(AnalyzeRetro::class, ['board_id' => $retro->id])->assertOk();
    $text = mcpPromptText($response);

    expect($text)->toContain('key themes')
        ->toContain('Never guess who wrote an anonymous message')
        ->toContain('Answer in English')
        ->and(json_encode(mcpPromptData($response)))
        ->toContain('Sprint 7 retro')
        ->toContain('Deploys are slow')
        ->toContain('Automate the release checklist');
});

it('keeps hidden and anonymous content redacted', function () {
    $writing = Retro::factory()->inPhase(RetroPhase::Writing)->create();
    [$user, $participant] = retroMember($writing);
    [, $other] = retroMember($writing);
    Card::factory()->create(['retro_id' => $writing->id, 'participant_id' => $participant->id, 'content' => 'My own visible idea']);
    Card::factory()->create(['retro_id' => $writing->id, 'participant_id' => $other->id, 'content' => 'Hidden thoughts XYZ']);

    $response = actingAsMcp($user)->prompt(AnalyzeRetro::class, ['board_id' => $writing->id])->assertOk();

    expect(mcpPromptText($response))->toContain('My own visible idea')->not->toContain('Hidden thoughts XYZ');

    $anonymous = Retro::factory()->anonymous()->inPhase(RetroPhase::Discussing)->create(['team_id' => $writing->team_id]);
    Participant::factory()->create(['retro_id' => $anonymous->id, 'user_id' => $user->id]);
    $theirs = Participant::factory()->create(['retro_id' => $anonymous->id, 'user_id' => $other->user_id]);
    Card::factory()->create(['retro_id' => $anonymous->id, 'participant_id' => $theirs->id, 'content' => 'Anonymous idea']);

    $data = mcpPromptData(actingAsMcp($user)->prompt(AnalyzeRetro::class, ['board_id' => $anonymous->id])->assertOk());
    $messages = collect($data['messages']['columns'] ?? [])->flatMap(fn (array $column): array => $column['messages']);
    $anonymousCard = $messages->firstWhere('content', 'Anonymous idea');

    expect($anonymousCard)->not->toBeNull()
        ->and($anonymousCard['author'] ?? null)->toBeNull();
});

it('omits insights when no provider is configured', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);
    RetroTheme::factory()->create(['retro_id' => $retro->id, 'name' => 'Release pain']);

    $withoutProvider = mcpPromptData(actingAsMcp($user)->prompt(AnalyzeRetro::class, ['board_id' => $retro->id])->assertOk());

    expect($withoutProvider)->not->toHaveKey('insights');

    configureLlm();

    $withProvider = mcpPromptData(actingAsMcp($user)->prompt(AnalyzeRetro::class, ['board_id' => $retro->id])->assertOk());

    expect($withProvider)->toHaveKey('insights');
});

it('caps prompt content', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['hide_vote_counts' => false]);
    [$user, $participant] = retroMember($retro);

    $cards = collect(range(1, 300))->map(fn (int $index): Card => Card::factory()->create([
        'retro_id' => $retro->id,
        'participant_id' => $participant->id,
        'content' => "Card {$index} ".str_repeat('x', 480),
        'position' => $index,
    ]));

    Vote::factory()->count(5)->create(['retro_id' => $retro->id, 'card_id' => $cards[299]->id]);

    $response = actingAsMcp($user)->prompt(AnalyzeRetro::class, ['board_id' => $retro->id])->assertOk();
    $data = mcpPromptData($response);
    $encoded = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    expect(mb_strlen($encoded))->toBeLessThanOrEqual(SkrumPrompt::MaxContentLength)
        ->and($encoded)->toContain('Card 300 ')
        ->and(mcpPromptText($response))->toContain('were left out to fit the size limit');
});

it('describes the team health over the last completed boards', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $user = teamMember($team);

    foreach (range(1, 7) as $index) {
        $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create([
            'team_id' => $team->id,
            'title' => "Retro {$index}",
            'created_at' => now()->subWeeks(8 - $index),
            'completed_at' => now()->subWeeks(8 - $index)->addDay(),
        ]);
        RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => 4]);
    }

    $data = mcpPromptData(actingAsMcp($user)->prompt(TeamHealth::class, ['team_id' => $team->id])->assertOk());

    expect($data['team']['name'])->toBe('Platform')
        ->and(collect($data['boards'])->pluck('board.title')->all())->toBe(['Retro 2', 'Retro 3', 'Retro 4', 'Retro 5', 'Retro 6', 'Retro 7']);
});

it('reports a team without completed boards', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $response = actingAsMcp($user)->prompt(TeamHealth::class, ['team_id' => $team->id])->assertOk();

    expect(mcpPromptData($response)['boards'])->toBe([])
        ->and(mcpPromptText($response))->toContain('health check not run yet');
});

it('refuses teams outside the grant', function () {
    $team = Team::factory()->create();
    $other = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $user = teamMember($team);
    $other->members()->attach($user);

    actingAsMcp($user)->prompt(TeamHealth::class, ['team_id' => Team::factory()->create()->id])->assertHasErrors(['Not found.']);
    actingAsMcp($user, [McpScope::Read], $team)->prompt(TeamHealth::class, ['team_id' => $other->id])->assertHasErrors(['Not found.']);
});

it('answers in the user language and never calls an LLM', function () {
    Http::fake();
    configureLlm();

    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);
    $user->update(['locale' => 'fr']);

    $text = mcpPromptText(actingAsMcp($user)->prompt(AnalyzeRetro::class, ['board_id' => $retro->id])->assertOk());

    expect($text)->toContain('Answer in French');
    Http::assertNothingSent();
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH"; vendor/bin/sail artisan test --compact tests/Feature/Mcp/PromptsTest.php`
Expected: FAIL — `Class "App\Mcp\Prompts\AnalyzeRetro" not found`.

- [ ] **Step 4: The prompt base**

Create `app/Mcp/Prompts/PromptToolFailed.php`:

```php
<?php

namespace App\Mcp\Prompts;

use RuntimeException;

class PromptToolFailed extends RuntimeException {}
```

Create `app/Mcp/Prompts/SkrumPrompt.php`:

```php
<?php

namespace App\Mcp\Prompts;

use App\Enums\McpScope;
use App\Mcp\McpGrant;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Prompt;

abstract class SkrumPrompt extends Prompt
{
    public const MaxContentLength = 60000;

    private const Languages = ['en' => 'English', 'fr' => 'French', 'es' => 'Spanish', 'de' => 'German'];

    public function shouldRegister(): bool
    {
        return McpGrant::current()->has(McpScope::Read);
    }

    /**
     * Runs a read tool as the current grant, so the prompt carries exactly
     * what the tool would return, with the same redaction.
     *
     * @param  class-string  $toolClass
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    protected function toolData(string $toolClass, array $arguments): array
    {
        $result = app($toolClass)->handle(new Request($arguments));

        if ($result instanceof Response) {
            throw new PromptToolFailed((string) $result->content());
        }

        if ($result instanceof ResponseFactory) {
            $error = $result->responses()->first(fn (Response $response): bool => $response->isError());

            if ($error !== null) {
                throw new PromptToolFailed((string) $error->content());
            }
        }

        return $result->getStructuredContent() ?? [];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected function message(string $instructions, array $data, ?string $note = null): Response
    {
        $language = self::Languages[McpGrant::current()->user->locale ?? 'en'] ?? 'English';
        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);

        $text = $instructions."\nAnswer in {$language}.";

        if ($note !== null) {
            $text .= "\n".$note;
        }

        return Response::text($text."\n\n```json\n".$json."\n```");
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected static function length(array $data): int
    {
        return mb_strlen((string) json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }
}
```

The embedded block is pretty-printed for the reader, but the cap is measured on the compact encoding (spec: content, not whitespace); `mcpPromptData()` re-encodes compactly in the cap test.

- [ ] **Step 5: `analyze-retro`**

Create `app/Mcp/Prompts/AnalyzeRetro.php`:

```php
<?php

namespace App\Mcp\Prompts;

use App\Mcp\McpContext;
use App\Mcp\McpFeature;
use App\Mcp\Tools\Retro\GetHealth;
use App\Mcp\Tools\Retro\GetRoti;
use App\Mcp\Tools\Retro\GetSummary;
use App\Mcp\Tools\Retro\ListBoardActionItems;
use App\Mcp\Tools\Retro\ListInsights;
use App\Mcp\Tools\Retro\ListMessages;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Prompts\Argument;

class AnalyzeRetro extends SkrumPrompt
{
    protected string $name = 'analyze-retro';

    protected string $description = 'Analyse one retrospective board: its summary, themes, agreements, health check, ROTI and messages.';

    private const Instructions = <<<'TEXT'
        You are helping a team reflect on a retrospective from skrum. The JSON below holds the board's summary, its themes and suggested actions (when available), its agreements (action items), its health check, its ROTI and its messages (most voted first when votes are visible).
        Identify the key themes, the risks, and what the team should change next time. Check that the agreements cover the top themes, and point to pending suggested actions the user may promote.
        Never guess who wrote an anonymous message.
        TEXT;

    /**
     * @return array<int, Argument>
     */
    public function arguments(): array
    {
        return [new Argument('board_id', 'The id of the retrospective board.', required: true)];
    }

    public function handle(Request $request, McpContext $context): Response
    {
        $boardId = $request->validate(['board_id' => ['required', 'uuid']])['board_id'];

        try {
            $context->retro($boardId);

            $data = ['summary' => $this->toolData(GetSummary::class, ['board_id' => $boardId])];

            if (McpFeature::Insights->isAvailable()) {
                $data['insights'] = $this->toolData(ListInsights::class, ['board_id' => $boardId]);
            }

            $data['agreements'] = $this->toolData(ListBoardActionItems::class, ['board_id' => $boardId]);
            $data['health'] = $this->toolData(GetHealth::class, ['board_id' => $boardId]);
            $data['roti'] = $this->toolData(GetRoti::class, ['board_id' => $boardId]);
            $data['messages'] = ['columns' => $this->messages($boardId)];
        } catch (ModelNotFoundException) {
            return Response::error(__('Not found.'));
        } catch (PromptToolFailed $failure) {
            return Response::error($failure->getMessage());
        }

        [$data, $dropped] = $this->fit($data);

        $note = $dropped === 0 ? null : "{$dropped} lowest-voted messages were left out to fit the size limit.";

        return $this->message(self::Instructions, $data, $note);
    }

    /**
     * All pages of the board's messages, most voted first when the board
     * shows vote totals, otherwise in board order.
     *
     * @return array<int, array<string, mixed>>
     */
    private function messages(string $boardId): array
    {
        try {
            return $this->allPages($boardId, 'votes');
        } catch (PromptToolFailed) {
            return $this->allPages($boardId, 'position');
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function allPages(string $boardId, string $sort): array
    {
        $columns = [];
        $page = 1;

        do {
            $result = $this->toolData(ListMessages::class, ['board_id' => $boardId, 'sort' => $sort, 'limit' => 200, 'page' => $page]);

            foreach ($result['columns'] ?? [] as $column) {
                $columns[$column['id']] ??= [...$column, 'messages' => []];
                $columns[$column['id']]['messages'] = [...$columns[$column['id']]['messages'], ...$column['messages']];
            }

            $page++;
        } while (($result['hasMore'] ?? false) === true && $page <= 50);

        return array_values($columns);
    }

    /**
     * Drops the lowest-voted top-level messages (with their grouped cards)
     * until the data fits the cap.
     *
     * @param  array<string, mixed>  $data
     * @return array{0: array<string, mixed>, 1: int}
     */
    private function fit(array $data): array
    {
        $dropped = 0;

        while (self::length($data) > self::MaxContentLength) {
            $candidates = [];

            foreach ($data['messages']['columns'] as $columnIndex => $column) {
                foreach ($column['messages'] as $messageIndex => $message) {
                    $candidates[] = [
                        'column' => $columnIndex,
                        'message' => $messageIndex,
                        'votes' => (int) ($message['votes'] ?? 0),
                        'size' => mb_strlen((string) json_encode($message, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) + 1,
                    ];
                }
            }

            if ($candidates === []) {
                break;
            }

            usort($candidates, fn (array $a, array $b): int => $a['votes'] <=> $b['votes']);

            $excess = self::length($data) - self::MaxContentLength;

            foreach ($candidates as $candidate) {
                unset($data['messages']['columns'][$candidate['column']]['messages'][$candidate['message']]);
                $dropped++;
                $excess -= $candidate['size'];

                if ($excess <= 0) {
                    break;
                }
            }

            foreach ($data['messages']['columns'] as $columnIndex => $column) {
                $data['messages']['columns'][$columnIndex]['messages'] = array_values($column['messages']);
            }
        }

        return [$data, $dropped];
    }
}
```

- [ ] **Step 6: `team-health`**

Create `app/Mcp/Prompts/TeamHealth.php`:

```php
<?php

namespace App\Mcp\Prompts;

use App\Mcp\McpContext;
use App\Mcp\McpFeature;
use App\Mcp\Tools\Retro\GetHealth;
use App\Mcp\Tools\Retro\GetRoti;
use App\Mcp\Tools\Retro\ListActionItems;
use App\Mcp\Tools\Retro\ListBoardActionItems;
use App\Mcp\Tools\Retro\ListBoards;
use App\Mcp\Tools\Retro\ListInsights;
use App\Mcp\Tools\Retro\ListMessages;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Prompts\Argument;

class TeamHealth extends SkrumPrompt
{
    protected string $name = 'team-health';

    protected string $description = "Describe a team's health over its last six completed retrospectives: health score, ROTI, agreements and recurring themes.";

    private const BoardCount = 6;

    private const Instructions = <<<'TEXT'
        You are helping a team understand how it is doing across its last completed retrospectives in skrum. The JSON below lists the boards oldest first with their health check, ROTI, agreements and recurring themes (or most voted messages), then the health and ROTI trends and the team's currently open and overdue agreements.
        Describe the trends, the strongest and weakest health categories, how many agreements get closed, and what keeps repeating. Compare a category only across boards that asked it (match categories by their key) and mention when the statement set changed (sameStatements false). If there is no data, say "health check not run yet".
        TEXT;

    /**
     * @return array<int, Argument>
     */
    public function arguments(): array
    {
        return [new Argument('team_id', 'The id of the team.', required: true)];
    }

    public function handle(Request $request, McpContext $context): Response
    {
        $teamId = $request->validate(['team_id' => ['required', 'uuid']])['team_id'];

        try {
            $team = $context->team($teamId);

            $boards = $this->toolData(ListBoards::class, ['team_id' => $teamId, 'finished_only' => true, 'limit' => self::BoardCount])['items'] ?? [];
            $boards = array_reverse($boards);

            $rows = array_map(fn (array $board): array => $this->board($board), $boards);
            $newest = $rows === [] ? null : $rows[array_key_last($rows)];

            $data = [
                'team' => ['id' => $team->id, 'name' => $team->name],
                'boards' => array_map(fn (array $row): array => $row['row'], $rows),
                'healthTrend' => $newest['healthTrend'] ?? [],
                'rotiTrend' => $newest['rotiTrend'] ?? [],
                'openAgreements' => $this->count($teamId, 'open'),
                'overdueAgreements' => $this->count($teamId, 'overdue'),
            ];
        } catch (ModelNotFoundException) {
            return Response::error(__('Not found.'));
        } catch (PromptToolFailed $failure) {
            return Response::error($failure->getMessage());
        }

        [$data, $trimmed] = $this->fit($data);

        $note = $trimmed ? 'The recurring themes of the oldest boards were left out to fit the size limit.' : null;

        return $this->message(self::Instructions, $data, $note);
    }

    /**
     * @param  array<string, mixed>  $board
     * @return array{row: array<string, mixed>, healthTrend: mixed, rotiTrend: mixed}
     */
    private function board(array $board): array
    {
        $health = $this->toolData(GetHealth::class, ['board_id' => $board['id']]);
        $roti = $this->toolData(GetRoti::class, ['board_id' => $board['id']]);
        $agreements = $this->toolData(ListBoardActionItems::class, ['board_id' => $board['id']]);
        $items = $agreements['items'] ?? $agreements;

        $healthTrend = $health['trend'] ?? [];
        $rotiTrend = $roti['trend'] ?? [];
        unset($health['trend'], $roti['trend']);

        return [
            'row' => [
                'board' => ['id' => $board['id'], 'title' => $board['title'], 'completedAt' => $board['completedAt'], 'url' => $board['url']],
                'health' => $health,
                'roti' => $roti,
                'agreements' => [
                    'created' => count($items),
                    'completed' => count(array_filter($items, fn (array $item): bool => ($item['status'] ?? null) === 'completed')),
                ],
                ...$this->recurring($board['id']),
            ],
            'healthTrend' => $healthTrend,
            'rotiTrend' => $rotiTrend,
        ];
    }

    /**
     * Spec 2 themes when insights are available, otherwise the five most
     * voted messages of the board.
     *
     * @return array<string, mixed>
     */
    private function recurring(string $boardId): array
    {
        if (McpFeature::Insights->isAvailable()) {
            $insights = $this->toolData(ListInsights::class, ['board_id' => $boardId]);

            return ['themes' => array_map(fn (array $theme): string => $theme['name'], $insights['themes'] ?? [])];
        }

        try {
            $messages = $this->toolData(ListMessages::class, ['board_id' => $boardId, 'sort' => 'votes', 'limit' => 50]);
        } catch (PromptToolFailed) {
            return ['topMessages' => []];
        }

        $top = collect($messages['columns'] ?? [])
            ->flatMap(fn (array $column): array => $column['messages'])
            ->sortByDesc(fn (array $message): int => (int) ($message['votes'] ?? 0))
            ->take(5)
            ->map(fn (array $message): array => ['content' => $message['content'], 'votes' => $message['votes']])
            ->values()
            ->all();

        return ['topMessages' => $top];
    }

    private function count(string $teamId, string $status): int
    {
        $total = 0;
        $page = 1;

        do {
            $result = $this->toolData(ListActionItems::class, ['team_id' => $teamId, 'status' => $status, 'limit' => 50, 'page' => $page]);
            $total += count($result['items'] ?? []);
            $page++;
        } while (($result['hasMore'] ?? false) === true && $page <= 20);

        return $total;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{0: array<string, mixed>, 1: bool}
     */
    private function fit(array $data): array
    {
        $trimmed = false;

        foreach (array_keys($data['boards']) as $index) {
            if (self::length($data) <= self::MaxContentLength) {
                break;
            }

            $data['boards'][$index]['themes'] = [];
            $data['boards'][$index]['topMessages'] = [];
            $trimmed = true;
        }

        return [$data, $trimmed];
    }
}
```

- [ ] **Step 7: Register the prompts**

In `app/Mcp/Servers/SkrumServer.php` add `use App\Mcp\Prompts\AnalyzeRetro;` and `use App\Mcp\Prompts\TeamHealth;` and set:

```php
    protected array $prompts = [
        AnalyzeRetro::class,
        TeamHealth::class,
    ];
```

(Keep the existing `$tools` array unchanged.)

- [ ] **Step 8: Translations**

`Not found.` already exists (Plan 11a). The prompt instructions and descriptions are English on purpose (read by models, spec §2.4), so no new key. Confirm: `grep -c '"Not found."' lang/*.json` → 1 in each file.

- [ ] **Step 9: Run the tests, pint, phpstan**

Run: `export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH"; vendor/bin/sail artisan test --compact tests/Feature/Mcp/PromptsTest.php && vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress`
Expected: all pass, 0 errors.

- [ ] **Step 10: Commit**

```bash
git add app/Mcp/Prompts app/Mcp/Servers/SkrumServer.php tests/Pest.php tests/Feature/Mcp/PromptsTest.php
git commit -m "feat: add the analyze-retro and team-health MCP prompts

Co-Authored-By: <your harness attribution>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

#### Implementer notes

- `SkrumTool::handle()` re-checks scope and feature; a prompt calls it under the current grant, so an Insights tool is only called when `McpFeature::Insights->isAvailable()`.
- If `laravel/mcp` wraps `Response::error()` of a prompt differently than a JSON-RPC error (`assertHasErrors(['Not found.'])` failing), throw an `Illuminate\Validation\ValidationException` or return the error text through `Response::text()` and adjust the tests — check `GetPrompt::handle()` (non-`Errable`: error responses become JSON-RPC errors, which `TestResponse::errors()` reads).

### Task 7: Catalogue, scope matrix, redaction sweep, broadcasts and rate limits

**Files:**
- Modify: `tests/Pest.php` (helpers `mcpContractToolNames()`, `mcpToolClass()`, `mcpPromptNames()`), `tests/Feature/Mcp/CatalogueTest.php` (replaced: supersedes Plan 11a Task 10's version)
- Create: `tests/Feature/Mcp/McpSweepTest.php`, `tests/Feature/Mcp/McpBroadcastsTest.php`, `tests/Feature/Mcp/McpWriteLimitTest.php`, `tests/Feature/Mcp/McpGrantIsolationTest.php`
- Modify only if a test fails: the offending tool (expected: none — every earlier task tested its own tool; this task proves the whole set together)

**Interfaces:**
- Consumes: every tool of Plans 11a/11b registered on `App\Mcp\Servers\SkrumServer` (`protected array $tools`), the prompts of Task 6, `actingAsMcp()`, `configureLlm()`, `teamMember()`, `openPokerRound()`, `pokerVote()`, `App\Actions\Mcp\IssueMcpToken::handle(User $user, string $name, array $scopes, ?Team $team, ?CarbonInterface $expiresAt): NewAccessToken`.
- Produces: Pest helpers `mcpContractToolNames(): array<int, string>` (the 25 contract names without the spec 6 tracker tools, sorted), `mcpToolClass(string $name): class-string` (resolves a tool class from `SkrumServer::$tools` by its `name()`), `mcpPromptNames(PendingTestResponse $pending): array<int, string>` (sorted names of the `prompts()` listing; tool names come from 11a's `mcpToolNames()`). Tests look tools up **by contract name**, so they do not depend on class names chosen by earlier tasks.

- [ ] **Step 1: Helpers**

Append to `tests/Pest.php` (`use App\Mcp\Servers\SkrumServer;` and `use Laravel\Mcp\Server\Testing\PendingTestResponse;` are already imported by Plan 11a Task 5):

```php
/**
 * The 25 tools of the QRetro contract that exist before spec 6 adds the
 * four tracker tools (spec §6.5 planning note).
 *
 * @return array<int, string>
 */
function mcpContractToolNames(): array
{
    $names = [
        'retro.teams.list',
        'retro.team.members.list',
        'retro.boards.list',
        'retro.boards.search',
        'retro.actions.list',
        'retro.board.messages.list',
        'retro.board.summary.get',
        'retro.board.actions.list',
        'retro.board.insights.list',
        'retro.board.health.get',
        'retro.board.roti.get',
        'poker.games.list',
        'poker.game.get',
        'poker.game.tasks.list',
        'retro.actions.create',
        'retro.actions.update',
        'retro.actions.complete',
        'retro.board.suggested_actions.promote',
        'retro.board.suggested_actions.reject',
        'retro.board.messages.update',
        'poker.games.create',
        'poker.game.tasks.add',
        'poker.game.task.select',
        'poker.game.task.reveal',
        'retro.board.messages.delete_own',
    ];

    sort($names);

    return $names;
}

/**
 * @return class-string
 */
function mcpToolClass(string $name): string
{
    $tools = (new ReflectionClass(SkrumServer::class))->getProperty('tools')->getDefaultValue();

    foreach ($tools as $class) {
        if (app($class)->name() === $name) {
            return $class;
        }
    }

    throw new RuntimeException("No MCP tool is named [{$name}].");
}

/**
 * @return array<int, string>
 */
function mcpPromptNames(PendingTestResponse $pending): array
{
    return collect((fn (): array => $this->items)->call($pending->prompts()))->pluck('name')->sort()->values()->all();
}
```


- [ ] **Step 2: Catalogue and scope matrix**

Replace `tests/Feature/Mcp/CatalogueTest.php` with:

```php
<?php

use App\Enums\McpScope;
use App\Models\Team;

$readTools = [
    'poker.game.get',
    'poker.game.tasks.list',
    'poker.games.list',
    'retro.actions.list',
    'retro.board.actions.list',
    'retro.board.health.get',
    'retro.board.insights.list',
    'retro.board.messages.list',
    'retro.board.roti.get',
    'retro.board.summary.get',
    'retro.boards.list',
    'retro.boards.search',
    'retro.team.members.list',
    'retro.teams.list',
];

$writeTools = [
    'poker.game.task.reveal',
    'poker.game.task.select',
    'poker.game.tasks.add',
    'poker.games.create',
    'retro.actions.complete',
    'retro.actions.create',
    'retro.actions.update',
    'retro.board.messages.update',
    'retro.board.suggested_actions.promote',
    'retro.board.suggested_actions.reject',
];

$insightTools = [
    'retro.board.insights.list',
    'retro.board.suggested_actions.promote',
    'retro.board.suggested_actions.reject',
];

it('registers exactly the contract tools and prompts', function () {
    configureLlm();
    $user = teamMember(Team::factory()->create());

    $server = actingAsMcp($user, McpScope::cases());

    expect(mcpToolNames($server))->toBe(mcpContractToolNames())
        ->and(mcpPromptNames($server))->toBe(['analyze-retro', 'team-health']);
});

it('lists exactly the tools of the granted scopes', function (array $scopes, array $expected) {
    configureLlm();
    $user = teamMember(Team::factory()->create());

    $expectedNames = $expected;
    sort($expectedNames);

    expect(mcpToolNames(actingAsMcp($user, $scopes)))->toBe($expectedNames);
})->with([
    'read' => [[McpScope::Read], $readTools],
    'read and write' => [[McpScope::Read, McpScope::Write], [...$readTools, ...$writeTools]],
    'read and delete' => [[McpScope::Read, McpScope::Delete], [...$readTools, 'retro.board.messages.delete_own']],
    'every scope' => [McpScope::cases(), [...$readTools, ...$writeTools, 'retro.board.messages.delete_own']],
]);

it('hides the insight tools without an LLM provider', function () use ($insightTools) {
    $user = teamMember(Team::factory()->create());

    $listed = mcpToolNames(actingAsMcp($user, McpScope::cases()));

    expect($listed)->toHaveCount(22)
        ->and(array_intersect($listed, $insightTools))->toBe([]);
});

it('refuses calls to tools outside the grant', function (string $name) {
    $user = teamMember(Team::factory()->create());

    actingAsMcp($user, [McpScope::Read])->tool(mcpToolClass($name), [])->assertHasErrors(["Tool [{$name}] not found."]);
})->with([...$writeTools, 'retro.board.messages.delete_own']);
```


- [ ] **Step 3: Redaction sweep over every tool**

Create `tests/Feature/Mcp/McpSweepTest.php`:

```php
<?php

use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\SuggestedAction;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Enums\WorkspaceRole;

/**
 * One team with a Discussing board (guest access on, a guest, another
 * member's card, the user's action item, two pending suggestions), a
 * Writing board holding two of the user's cards, and a poker game the
 * user facilitates with a voted current task and a second task.
 *
 * @return array<string, mixed>
 */
function mcpSweepWorld(): array
{
    $workspace = Workspace::factory()->create();
    $team = Team::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Sweep team']);

    $user = User::factory()->create(['email' => 'sweep-user@example.test', 'name' => 'Sweep User']);
    $other = User::factory()->create(['email' => 'sweep-other@example.test', 'name' => 'Sweep Other']);

    foreach ([$user, $other] as $member) {
        $workspace->members()->attach($member, ['role' => WorkspaceRole::Member->value]);
        $team->members()->attach($member);
    }

    $discussing = Retro::factory()->withGuestAccess()->inPhase(RetroPhase::Discussing)->create([
        'team_id' => $team->id,
        'title' => 'Sweep board',
    ]);
    $mine = Participant::factory()->create(['retro_id' => $discussing->id, 'user_id' => $user->id]);
    $theirs = Participant::factory()->create(['retro_id' => $discussing->id, 'user_id' => $other->id]);
    Participant::factory()->guest('guest-secret-value')->create(['retro_id' => $discussing->id]);
    Card::factory()->create(['retro_id' => $discussing->id, 'participant_id' => $theirs->id, 'content' => 'Sweep message']);

    $actionItem = ActionItem::factory()->create([
        'retro_id' => $discussing->id,
        'content' => 'Sweep agreement',
        'created_by_participant_id' => $mine->id,
        'created_by_user_id' => $user->id,
        'assignee_user_id' => $other->id,
    ]);

    $promote = SuggestedAction::factory()->create(['retro_id' => $discussing->id, 'content' => 'Promote me']);
    $reject = SuggestedAction::factory()->create(['retro_id' => $discussing->id, 'content' => 'Reject me', 'position' => 1]);

    $writing = Retro::factory()->inPhase(RetroPhase::Writing)->create(['team_id' => $team->id]);
    $writer = Participant::factory()->create(['retro_id' => $writing->id, 'user_id' => $user->id]);
    $editable = Card::factory()->create(['retro_id' => $writing->id, 'participant_id' => $writer->id]);
    $deletable = Card::factory()->create(['retro_id' => $writing->id, 'participant_id' => $writer->id, 'position' => 1]);

    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    $player = PokerPlayer::factory()->create(['poker_game_id' => $game->id, 'user_id' => $user->id]);
    $game->update(['facilitator_player_id' => $player->id]);
    $current = PokerTask::factory()->create(['poker_game_id' => $game->id]);
    $next = PokerTask::factory()->create(['poker_game_id' => $game->id]);
    pokerVote(openPokerRound($game, $current), $player, '5');

    return [
        'user' => $user,
        'team' => $team,
        'discussing' => $discussing,
        'writing' => $writing,
        'actionItem' => $actionItem,
        'promote' => $promote,
        'reject' => $reject,
        'editable' => $editable,
        'deletable' => $deletable,
        'game' => $game,
        'current' => $current,
        'next' => $next,
        'secrets' => [
            'sweep-user@example.test',
            'sweep-other@example.test',
            $discussing->guest_token,
            $writing->guest_token,
            $game->guest_token,
            'guest-secret-value',
            'guest_secret_hash',
        ],
    ];
}

/**
 * @return array<string, Closure(array<string, mixed>): array<string, mixed>>
 */
function mcpSweepArguments(): array
{
    return [
        'retro.teams.list' => fn (array $w): array => [],
        'retro.team.members.list' => fn (array $w): array => ['team_id' => $w['team']->id],
        'retro.boards.list' => fn (array $w): array => ['team_id' => $w['team']->id],
        'retro.boards.search' => fn (array $w): array => ['query' => 'Sweep'],
        'retro.actions.list' => fn (array $w): array => ['status' => 'all'],
        'retro.board.messages.list' => fn (array $w): array => ['board_id' => $w['discussing']->id],
        'retro.board.summary.get' => fn (array $w): array => ['board_id' => $w['discussing']->id],
        'retro.board.actions.list' => fn (array $w): array => ['board_id' => $w['discussing']->id],
        'retro.board.insights.list' => fn (array $w): array => ['board_id' => $w['discussing']->id],
        'retro.board.health.get' => fn (array $w): array => ['board_id' => $w['discussing']->id],
        'retro.board.roti.get' => fn (array $w): array => ['board_id' => $w['discussing']->id],
        'poker.games.list' => fn (array $w): array => ['team_id' => $w['team']->id],
        'poker.game.get' => fn (array $w): array => ['game_id' => $w['game']->id],
        'poker.game.tasks.list' => fn (array $w): array => ['game_id' => $w['game']->id],
        'retro.actions.create' => fn (array $w): array => ['board_id' => $w['discussing']->id, 'content' => 'New sweep item'],
        'retro.actions.update' => fn (array $w): array => ['action_id' => $w['actionItem']->id, 'content' => 'Edited sweep item'],
        'retro.actions.complete' => fn (array $w): array => ['action_id' => $w['actionItem']->id],
        'retro.board.suggested_actions.promote' => fn (array $w): array => ['board_id' => $w['discussing']->id, 'suggested_action_id' => $w['promote']->id],
        'retro.board.suggested_actions.reject' => fn (array $w): array => ['board_id' => $w['discussing']->id, 'suggested_action_id' => $w['reject']->id],
        'retro.board.messages.update' => fn (array $w): array => ['message_id' => $w['editable']->id, 'content' => 'Edited sweep card'],
        'poker.games.create' => fn (array $w): array => ['team_id' => $w['team']->id, 'title' => 'Sweep game', 'deck' => 'fibonacci'],
        'poker.game.tasks.add' => fn (array $w): array => ['game_id' => $w['game']->id, 'tasks' => [['title' => 'Sweep story']]],
        'poker.game.task.select' => fn (array $w): array => ['game_id' => $w['game']->id, 'task_id' => $w['next']->id],
        'poker.game.task.reveal' => fn (array $w): array => ['game_id' => $w['game']->id, 'task_id' => $w['current']->id],
        'retro.board.messages.delete_own' => fn (array $w): array => ['message_id' => $w['deletable']->id],
    ];
}

it('sweeps every contract tool', function () {
    $swept = array_keys(mcpSweepArguments());
    sort($swept);

    expect($swept)->toBe(mcpContractToolNames());
});

it('never returns an email, a guest token, a guest link or a secret', function (string $name) {
    configureLlm();
    $world = mcpSweepWorld();

    actingAsMcp($world['user'], McpScope::cases())
        ->tool(mcpToolClass($name), mcpSweepArguments()[$name]($world))
        ->assertHasNoErrors()
        ->assertDontSee($world['secrets']);
})->with(array_keys(mcpSweepArguments()));

it('never puts secrets in prompts', function () {
    configureLlm();
    $world = mcpSweepWorld();
    $server = actingAsMcp($world['user'], McpScope::cases());

    expect(mcpPromptText($server->prompt(mcpPromptClass('analyze-retro'), ['board_id' => $world['discussing']->id])->assertOk()))
        ->not->toContain(...$world['secrets'])
        ->and(mcpPromptText($server->prompt(mcpPromptClass('team-health'), ['team_id' => $world['team']->id])->assertOk()))
        ->not->toContain(...$world['secrets']);
});

/**
 * @return class-string
 */
function mcpPromptClass(string $name): string
{
    return $name === 'analyze-retro' ? App\Mcp\Prompts\AnalyzeRetro::class : App\Mcp\Prompts\TeamHealth::class;
}
```

`not->toContain(...$values)` fails if any value is contained.

- [ ] **Step 4: Broadcasts**

Create `tests/Feature/Mcp/McpBroadcastsTest.php`:

```php
<?php

use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Events\ActionItems\ActionItemCreated;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Events\Poker\PokerRoundChanged;
use App\Events\Poker\PokerTaskSaved;
use App\Events\Retros\ActionItemSaved;
use App\Events\Retros\CardDeleted;
use App\Events\Retros\CardUpdated;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake([
        ActionItemSaved::class,
        TeamActionItemSaved::class,
        ActionItemCreated::class,
        CardUpdated::class,
        CardDeleted::class,
        PokerTaskSaved::class,
        PokerRoundChanged::class,
    ]);
});

it('broadcasts action item writes to everyone', function () {
    $world = mcpSweepWorld();

    actingAsMcp($world['user'], McpScope::cases())
        ->tool(mcpToolClass('retro.actions.create'), ['board_id' => $world['discussing']->id, 'content' => 'Broadcast me'])
        ->assertHasNoErrors();

    Event::assertDispatched(ActionItemSaved::class, fn (ActionItemSaved $event): bool => $event->socket === null
        && $event->actionItem['content'] === 'Broadcast me');
    Event::assertDispatched(TeamActionItemSaved::class);
    Event::assertDispatched(ActionItemCreated::class);
});

it('broadcasts own message edits and deletions to everyone', function () {
    $world = mcpSweepWorld();
    $server = actingAsMcp($world['user'], McpScope::cases());

    $server->tool(mcpToolClass('retro.board.messages.update'), ['message_id' => $world['editable']->id, 'content' => 'Changed'])->assertHasNoErrors();
    $server->tool(mcpToolClass('retro.board.messages.delete_own'), ['message_id' => $world['deletable']->id])->assertHasNoErrors();

    Event::assertDispatched(CardUpdated::class, fn (CardUpdated $event): bool => $event->socket === null);
    Event::assertDispatched(CardDeleted::class, fn (CardDeleted $event): bool => $event->socket === null && $event->cardId === $world['deletable']->id);
});

it('broadcasts poker writes to everyone', function () {
    $world = mcpSweepWorld();
    $server = actingAsMcp($world['user'], McpScope::cases());

    $server->tool(mcpToolClass('poker.game.tasks.add'), ['game_id' => $world['game']->id, 'tasks' => [['title' => 'A'], ['title' => 'B']]])->assertHasNoErrors();
    $server->tool(mcpToolClass('poker.game.task.reveal'), ['game_id' => $world['game']->id, 'task_id' => $world['current']->id])->assertHasNoErrors();

    Event::assertDispatchedTimes(PokerTaskSaved::class, 3);
    Event::assertDispatched(PokerRoundChanged::class, fn (PokerRoundChanged $event): bool => $event->socket === null);
});
```

`PokerTaskSaved` is dispatched three times: two added tasks plus the estimate set by the reveal (spec 4 `SetPokerEstimate` broadcasts `task.saved`). If the reveal's estimate is not determined (single vote `5` → nearest card `5`, so it is), adjust the count.

The events are faked, and `sendToOthers()` registers the broadcast after commit, so the fake records the event when the MCP tool's transaction commits.

- [ ] **Step 5: Write rate limit**

Create `tests/Feature/Mcp/McpWriteLimitTest.php`:

```php
<?php

use App\Enums\McpScope;

it('limits writes and deletions per token while reads keep working', function () {
    config(['skrum.mcp.write_rate_limit' => 2]);
    $world = mcpSweepWorld();
    $server = actingAsMcp($world['user'], McpScope::cases());
    $add = fn () => $server->tool(mcpToolClass('poker.game.tasks.add'), ['game_id' => $world['game']->id, 'tasks' => [['title' => 'Limited']]]);

    $add()->assertHasNoErrors();
    $add()->assertHasNoErrors();
    $add()->assertHasErrors(['Too many changes, wait a moment.']);

    $server->tool(mcpToolClass('retro.board.messages.delete_own'), ['message_id' => $world['deletable']->id])
        ->assertHasErrors(['Too many changes, wait a moment.']);

    $server->tool(mcpToolClass('retro.teams.list'))->assertHasNoErrors();

    expect($world['game']->tasks()->count())->toBe(4);
});
```

(4 = the two fixture tasks plus the two allowed additions.)

- [ ] **Step 6: The grant never leaks between requests**

Create `tests/Feature/Mcp/McpGrantIsolationTest.php`:

```php
<?php

use App\Actions\Mcp\IssueMcpToken;
use App\Models\Team;

/**
 * @param  array<string, mixed>  $arguments
 * @return array<string, mixed>
 */
function mcpToolCallPayload(string $tool, array $arguments = []): array
{
    return ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'tools/call', 'params' => ['name' => $tool, 'arguments' => (object) $arguments]];
}

it('builds a fresh grant for every request', function () {
    $alpha = Team::factory()->create(['name' => 'Team Alpha']);
    $beta = Team::factory()->create(['name' => 'Team Beta']);
    $ann = teamMember($alpha);
    $bob = teamMember($beta);

    $annToken = app(IssueMcpToken::class)->handle($ann, 'ann', [], null, null)->plainTextToken;
    $bobToken = app(IssueMcpToken::class)->handle($bob, 'bob', [], null, null)->plainTextToken;

    $first = json_encode(postMcp($annToken, mcpToolCallPayload('retro.teams.list'))->assertOk()->json());
    $second = json_encode(postMcp($bobToken, mcpToolCallPayload('retro.teams.list'))->assertOk()->json());

    expect($first)->toContain('Team Alpha')->not->toContain('Team Beta')
        ->and($second)->toContain('Team Beta')->not->toContain('Team Alpha');
});
```

If the server rejects `tools/call` before `initialize` in this `laravel/mcp` version, send an `initialize` request first with the same token (Plan 11a Task 4's authentication tests show the exact payload).

- [ ] **Step 7: Run the whole MCP suite**

Run: `export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH"; vendor/bin/sail artisan test --compact tests/Feature/Mcp`
Expected: all green. A failure here is a real defect in the named tool: fix it in that tool's file (smallest change, same rules as its own task), rerun, and mention it in the commit message.

Then `vendor/bin/sail bin pint --dirty --format agent` and `vendor/bin/sail bin phpstan analyse --no-progress` → clean.

- [ ] **Step 8: Commit**

```bash
git add tests/Pest.php tests/Feature/Mcp/CatalogueTest.php tests/Feature/Mcp/McpSweepTest.php tests/Feature/Mcp/McpBroadcastsTest.php tests/Feature/Mcp/McpWriteLimitTest.php tests/Feature/Mcp/McpGrantIsolationTest.php
git commit -m "test: prove the MCP catalogue, scopes, redaction and broadcasts end to end

Co-Authored-By: <your harness attribution>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

#### Implementer notes

- The sweep fixture assumes the rules of Plans 11a/11b tasks: `retro.actions.update` by the item's author (a manager, spec 3), `messages.update`/`delete_own` in `Writing`, promote/reject in `Discussing`, poker writes by the facilitator. If a tool refuses an argument set the spec allows, that is a tool defect; if it refuses one the spec refuses, fix the fixture.
- `retro.actions.update` and `retro.actions.complete` share one action item across dataset cases; each dataset case runs on a fresh database (`RefreshDatabase`), so they do not interfere.
- The 11a version of `CatalogueTest.php` also held an 11a-only "no email" sweep; this task's `McpSweepTest.php` supersedes it — delete that test when replacing the file.

### Task 8: Packaging and documentation

**Files:**
- Modify: `README.md` (new section "Connect an AI assistant", three rows in the Configuration table)
- Create: `tests/Feature/Mcp/McpPackagingTest.php`
- No change expected: `docker/Caddyfile` (`/mcp` is an ordinary PHP route served by Octane; `laravel/mcp` answers `application/json` unless a tool streams, and no skrum tool streams), `routes/console.php` (the `sanctum:prune-expired` schedule was added by Plan 11a Task 1)

**Interfaces:**
- Consumes: `routes/ai.php` and `SkrumServer` (Plan 11a Task 4), `config('skrum.mcp.*')`, `IssueMcpToken` (Plan 11a Task 2).
- Produces: documentation; a packaging test pinning that `laravel/mcp` and `laravel/sanctum` are production dependencies, that `/mcp` survives route caching, that GET is refused, and that the prune schedule exists; a verified production-image smoke run recorded in the ledger.

- [ ] **Step 1: Write the failing packaging test**

Create `tests/Feature/Mcp/McpPackagingTest.php`:

```php
<?php

use Illuminate\Console\Scheduling\Event as ScheduledEvent;
use Illuminate\Console\Scheduling\Schedule;

it('ships laravel/mcp and laravel/sanctum as production dependencies', function () {
    $composer = json_decode((string) file_get_contents(base_path('composer.json')), true);

    expect($composer['require'])->toHaveKeys(['laravel/mcp', 'laravel/sanctum'])
        ->and($composer['require-dev'] ?? [])->not->toHaveKey('laravel/mcp')
        ->and($composer['require-dev'] ?? [])->not->toHaveKey('laravel/sanctum');
});

it('refuses GET on the MCP endpoint', function () {
    $this->get('/mcp')->assertStatus(405)->assertHeader('Allow', 'POST');
});

it('prunes expired tokens daily after thirty days', function () {
    $commands = collect(app(Schedule::class)->events())
        ->map(fn (ScheduledEvent $event): string => (string) $event->command);

    expect($commands->contains(fn (string $command): bool => str_contains($command, 'sanctum:prune-expired --hours=720')))->toBeTrue();
});

it('documents the MCP settings', function () {
    $readme = (string) file_get_contents(base_path('README.md'));
    $env = (string) file_get_contents(base_path('.env.example'));

    foreach (['SKRUM_MCP_ENABLED', 'SKRUM_MCP_RATE_LIMIT', 'SKRUM_MCP_WRITE_RATE_LIMIT'] as $key) {
        expect($readme)->toContain($key)->and($env)->toContain($key);
    }

    expect($readme)->toContain('## Connect an AI assistant');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH"; vendor/bin/sail artisan test --compact tests/Feature/Mcp/McpPackagingTest.php`
Expected: FAIL on "documents the MCP settings" (no README section yet). The other three should already pass; if "ships … production dependencies" fails, move the packages from `require-dev` to `require` (`vendor/bin/sail composer require laravel/mcp laravel/sanctum`) — the production image installs with `--no-dev`.

- [ ] **Step 3: `.env.example`**

Plan 11a Task 1 already added the `SKRUM_MCP_ENABLED`, `SKRUM_MCP_RATE_LIMIT` and `SKRUM_MCP_WRITE_RATE_LIMIT` block; confirm with `grep -n "SKRUM_MCP_" .env.example` (three lines). The packaging test pins it.

- [ ] **Step 4: README**

In `README.md`, add three rows to the Configuration table, after the `SKRUM_AVATAR_STYLE` row (keep the table's column alignment; `npx vp check --fix README.md` re-aligns it):

```markdown
| `SKRUM_MCP_ENABLED`                                                | Serve the MCP server at `/mcp` and show the "API tokens" settings page (default `true`).                                                  |
| `SKRUM_MCP_RATE_LIMIT`                                             | MCP requests per minute per API token (default `120`).                                                                                   |
| `SKRUM_MCP_WRITE_RATE_LIMIT`                                       | MCP write and delete tool calls per minute per API token (default `30`).                                                                 |
```

Then insert this section before `## Local development`:

````markdown
## Connect an AI assistant

Skrum serves a [Model Context Protocol](https://modelcontextprotocol.io) server at `{APP_URL}/mcp`, so an AI assistant can read your team's retrospectives, action items and planning poker games, and make the changes you allow.

1. In skrum, open **Settings → API tokens** and create a token. Reading is always included; tick **Create and update** to let the assistant add or change action items, messages and poker games, and **Delete my messages** to let it delete messages you wrote. You can limit a token to one team and choose when it expires (90 days by default).
2. Copy the token when it is shown: skrum stores only its hash and cannot show it again.
3. Add the server to a client that can send an `Authorization` header. With Claude Code:

   ```bash
   claude mcp add --transport http skrum https://skrum.example.com/mcp --header "Authorization: Bearer <token>"
   ```

   Other clients (Cursor, VS Code, scripts) take the same URL and header, for example:

   ```json
   {
       "mcpServers": {
           "skrum": {
               "type": "http",
               "url": "https://skrum.example.com/mcp",
               "headers": { "Authorization": "Bearer <token>" }
           }
       }
   }
   ```

What the assistant can do matches what you can do in skrum, for the teams you can see (and only the bound team when the token has one). Everything the board hides stays hidden: other people's cards while they are still being written, the authors of anonymous messages, who voted for what, individual health check and ROTI answers, and poker cards before they are revealed (and, in anonymous rounds, who played which card). No tool returns email addresses, guest links or credentials. No tool votes or sets a poker estimate for you.

Sign-in through OAuth is not supported yet, so web connectors that require it (claude.ai, ChatGPT) cannot connect. Revoking a token on the settings page takes effect on the next request; changing your password does not revoke tokens. Data you read through the server is sent to the AI application you use.

Set `SKRUM_MCP_ENABLED=false` to turn the server and the settings page off; existing tokens are kept but refused.
````

- [ ] **Step 5: Route caching**

The production image runs `php artisan optimize` at start (`docker/scripts/prepare`), which caches routes; `laravel/mcp` then skips loading `routes/ai.php` and relies on the cache. Verify the MCP routes survive caching:

Run:
```bash
export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH"
vendor/bin/sail artisan route:cache
vendor/bin/sail artisan route:list --path=mcp
vendor/bin/sail artisan route:clear
```
Expected: `route:cache` succeeds; `route:list` shows `POST mcp`, `GET|HEAD mcp`, `DELETE mcp`. If `route:cache` fails on a closure route, stop and report it (the fix belongs to the package configuration and needs a ruling).

Note for operators (README already states it through "turn the server off"): `SKRUM_MCP_ENABLED` is read when routes and config are cached, i.e. at container start — changing it needs a restart.

- [ ] **Step 6: Run the tests and format**

Run: `export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH"; vendor/bin/sail artisan test --compact tests/Feature/Mcp/McpPackagingTest.php && npx vp check --fix README.md`
Expected: PASS; README formatted.

- [ ] **Step 7: Production image smoke test (Caddy + Octane)**

Build and start the production image on a side port, without touching the dev stack (`-p` isolates the project; the override adds a smoke env file loaded after `.env`):

```bash
export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH"
cat > /tmp/skrum-smoke.env <<'EOF'
APP_KEY=base64:c2tydW0tc21va2UtdGVzdC1rZXktMzItYnl0ZXMhISE=
APP_URL=http://localhost:8088
SERVER_NAME=:80
DB_PASSWORD=smoke
REVERB_APP_ID=smoke
REVERB_APP_KEY=smoke-key
REVERB_APP_SECRET=smoke-secret
SKRUM_HTTP_PORT=8088
SKRUM_HTTPS_PORT=8443
EOF
cat > /tmp/skrum-smoke.override.yaml <<'EOF'
services:
    app:
        env_file:
            - .env
            - /tmp/skrum-smoke.env
EOF
SKRUM_HTTP_PORT=8088 SKRUM_HTTPS_PORT=8443 DB_PASSWORD=smoke \
  docker compose -p skrum-smoke -f compose.production.yaml -f /tmp/skrum-smoke.override.yaml up -d --build
docker compose -p skrum-smoke -f compose.production.yaml ps
```

Wait until `app` is healthy, then create a verified user and a token inside the container:

```bash
TOKEN=$(docker compose -p skrum-smoke -f compose.production.yaml exec -T app php artisan tinker --execute '
$user = App\Models\User::factory()->make(["email" => "smoke@example.test"]);
$user->email_verified_at = now(); $user->save();
echo app(App\Actions\Mcp\IssueMcpToken::class)->handle($user, "smoke", [], null, null)->plainTextToken;
' | tail -n1)
```

If factories are unavailable in the `--no-dev` image (Faker missing), create the user with `App\Models\User::forceCreate(["name" => "Smoke", "email" => "smoke@example.test", "password" => bcrypt(Str::random(20)), "email_verified_at" => now()])` instead.

Then:

```bash
curl -si http://localhost:8088/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"1"}}}' | head -5
curl -s http://localhost:8088/mcp -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"1"}}}'
curl -s http://localhost:8088/mcp -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | php -r '$r = json_decode(stream_get_contents(STDIN), true); echo count($r["result"]["tools"]), PHP_EOL;'
docker compose -p skrum-smoke -f compose.production.yaml logs app | grep -c "$TOKEN"
```

Expected:
1. First call: `HTTP/1.1 401` and a `WWW-Authenticate: Bearer realm="skrum"` header.
2. Second call: a JSON result with `"serverInfo":{"name":"skrum"` (not an event stream, returned in full at once — no buffering issue through Caddy).
3. `tools/list`: `22` (no LLM provider configured in the smoke env: the three insight tools are absent).
4. The token appears `0` times in the container logs.

Tear down: `docker compose -p skrum-smoke -f compose.production.yaml down -v && rm /tmp/skrum-smoke.env /tmp/skrum-smoke.override.yaml`.

Record the four results in the plan's ledger (no commit for this step). If Docker cannot build the image in the implementer's environment, report the step as not run (DONE_WITH_CONCERNS) — the controller runs it.

- [ ] **Step 8: Commit**

```bash
git add README.md tests/Feature/Mcp/McpPackagingTest.php
git commit -m "docs: explain how to connect an AI assistant to skrum

Co-Authored-By: <your harness attribution>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

#### Implementer notes

- `laravel/mcp`'s `Mcp::web()` registers GET and DELETE closures answering 405; Plan 11a Task 4 attaches its middleware only to the POST route that `Mcp::web()` returns, so the "refuses GET" test expects 405 without authentication.
- The smoke APP_KEY is a throwaway 32-byte base64 value for the local smoke run only; never reuse it.

### Task 9: Verification (controller-driven)

**Files:** none new (fixes only, each in its own commit with a `fix:` message and a regression test).

**Interfaces:**
- Consumes: everything of Plans 11a and 11b.
- Produces: green test/lint/type runs, a passed Claude Code walkthrough recorded in the ledger, and the user's full-suite run.

- [ ] **Step 1: MCP and neighbouring suites**

Run: `export PATH="$HOME/.orbstack/bin:/opt/homebrew/bin:$PATH"; vendor/bin/sail artisan test --compact tests/Feature/Mcp tests/Feature/Retros tests/Feature/ActionItems tests/Feature/Poker tests/Feature/Settings tests/Feature/TranslationKeysTest.php tests/Feature/UuidPrimaryKeysTest.php`
Expected: all green.

- [ ] **Step 2: Static checks**

Run: `vendor/bin/sail bin phpstan analyse --no-progress` → 0 errors; `vendor/bin/sail bin pint --dirty --format agent` → clean.

- [ ] **Step 3: Frontend**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check && npm run build`
Expected: types clean; `check` fails only on the known pre-existing files (`.devcontainer/devcontainer.json`, `docs/superpowers/*.md`); build succeeds.

- [ ] **Step 4: Contract check**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mcp/CatalogueTest.php tests/Feature/Mcp/McpSweepTest.php`
Expected: the catalogue equals the 25 contract names (the four tracker tools wait for spec 6) and the two prompts; the sweep covers every tool.

- [ ] **Step 5: Full suite**

Ask the user to run: `vendor/bin/sail artisan test --compact`.

- [ ] **Step 6: Walkthrough with Claude Code** (driven step by step with the user)

Setup: dev stack running (`vendor/bin/sail up -d`, `npm run build` or `npm run dev`, Reverb and a queue worker: `vendor/bin/sail artisan reverb:start` and `vendor/bin/sail artisan queue:work`), demo data (`vendor/bin/sail artisan db:seed --class=DemoSeeder`), an LLM provider configured for the insight steps (`SKRUM_LLM_*` in `.env`; skip steps 5–6 without one). Browser A: `facilitator@skrum.test`. Claude Code runs on the same machine.

1. **Settings page.** A opens Settings → "API tokens": intro with the server URL `http://localhost/mcp` and a copy button, the two notices, "No API tokens yet.".
2. **Create a token.** "Create token" asks for the password; name "Walkthrough", tick "Create and update" and "Delete my messages", team "Demo Team", expiration 30 days. The next dialog shows the token once with a copy button and the Claude Code snippet; closing it, the table lists `skrum_…` + 4 characters, the three permission badges, "Demo Team", the expiry date, "Never" as last used.
3. **Connect.** In a terminal: `claude mcp add --transport http skrum http://localhost/mcp --header "Authorization: Bearer <token>"`, then in Claude Code `/mcp`: skrum is connected and lists 25 tools (22 without an LLM provider) and the prompts `analyze-retro` and `team-health`. The token row's "Last used" updates on reload.
4. **Read a retro.** Ask: "What did the Demo Team agree on in its last retrospective?". Expected: Claude calls `retro.boards.list` then `retro.board.summary.get` / `retro.board.actions.list`; the answer names the demo retro and its action items with assignee names, and no email address appears in any tool result (inspect the tool output in Claude Code).
5. **Insights (LLM configured).** Move the demo retro to Completed in A with the AI summary on, wait for the summary, then ask for "the insights of that retro": `retro.board.insights.list` returns themes and suggested actions.
6. **Promote a suggestion.** Ask Claude to promote one suggested action. Expected: A (board open, Results view) sees the new action item appear live with the suggestion's wording; asking again for the same suggestion → "This suggestion was already handled.".
7. **Overdue items and completion.** In A, give an action item a past due date. Ask "list my overdue action items" (`retro.actions.list` with `status: overdue`), then "complete it". Expected: A sees the item turn completed live without reload.
8. **Hidden cards.** In A, create a new retro, stay in Writing; log in as `member@skrum.test` in browser B and write a card "Secret draft". Ask Claude to list that board's messages: B's card is hidden (no content, sentiment or category) and "Secret draft" appears in no result, including `retro.boards.search` for "Secret".
9. **Anonymous authors.** On an anonymous retro in Discussing with B's card, the messages list shows the card's content with no author, while action items stay named.
10. **Poker tasks.** Ask Claude to create a poker game "MCP game" for Demo Team and add five stories. Expected: A opens the game from the team page and sees the five tasks in order; the facilitator is A (the token's user).
11. **Select, vote, reveal.** Ask Claude to select the first story; A and B (joined as a member) vote in the browser (`5` and `8`). Ask Claude for the game state before reveal: no card value is returned, only who voted. Ask Claude to reveal: A and B see the cards turn over live and the estimate `8` (nearest card to the 6.5 average, tie → higher) appear on the task; the tool result reports `estimateSet: true`.
12. **Anonymous round.** In A's settings turn on "Anonymous votes", re-vote in the browser, vote, and ask Claude to reveal: the returned `round.votes` carry no one's value (except A's own), `result.distribution` holds both values.
13. **No voting through MCP.** Ask Claude to vote `3` or to set the estimate to `13` directly: it has no tool for either and says so.
14. **Delete own message.** Ask Claude to delete one of A's own cards on a board in Writing: the card disappears live in the browser; asking to delete B's card → "Not found.".
15. **Scope and binding.** Create a second read-only token bound to another team; connect it as `skrum-ro`: only read tools are listed, and asking about Demo Team's boards returns nothing ("Not found."/empty).
16. **Revoke.** Revoke the "Walkthrough" token in A: the next Claude Code call to `skrum` fails with an authentication error (401).
17. **Disabled instance.** Set `SKRUM_MCP_ENABLED=false`, restart (`vendor/bin/sail artisan optimize:clear` and reload): the settings entry disappears and `curl -si http://localhost/mcp` answers 404. Set it back to `true`.
18. **Translations.** Switch A's language to French, Spanish and German: the API tokens page and its dialogs are fully translated; with A's locale French, a refused tool call (e.g. step 14's "Not found.") comes back in French ("Introuvable." or the project's translation).

- [ ] **Step 7:** Record each walkthrough item's outcome in the ledger; for every failure, fix it in its own commit (with a regression test for backend fixes), rerun the affected tests and the item.

#### Implementer notes

- Step 11's estimate assumes the Fibonacci deck: average of 5 and 8 is 6.5, the nearest cards are 5 (distance 1.5) and 8 (distance 1.5), and ties go to the higher card (spec 4), so `8`.
- Step 18: use whatever French translation Plan 11a added for "Not found."; the point is that tool errors follow `users.locale`.
