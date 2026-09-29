# Plan 3 — Retro Backend (domain, access, guests, snapshot, mutations, broadcasting) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everything a retrospective needs on the server: data model, creation from a team, participant resolution for members and guests, per-viewer redacted board snapshots, every board mutation with phase and facilitator rules, and realtime broadcast events on a presence channel.

**Architecture:** A retro board lives at `/retros/{retro}`; a middleware resolves the viewer's `Participant` (team member → own participant row, guest → encrypted cookie) and stores it on the request. Mutations are small JSON controllers nested under `/retros/{retro}/…` with scoped bindings, guarded by a static `RetroGuard` (phase / facilitator / author checks → 403) and validation (422), persisting in transactions and broadcasting `ShouldBroadcastNow` + `ShouldDispatchAfterCommit` events to `presence-retro.{id}` excluding the sender's socket. All redaction lives in `PresentCard` and `BuildBoardSnapshot`; broadcast payloads are the "other participant" view (viewer `null`).

**Tech Stack:** Laravel 13, Inertia v3 + React 19 (only thin pages here — the board UI is Plan 4), Laravel Reverb (Pusher protocol) for broadcasting, `dicebear/core` + `dicebear/styles` for avatars, Pest, PostgreSQL via Sail.

**Spec:** `docs/superpowers/specs/2026-09-29-retro-board-core-design.md` (§2 Domain model, §3 Guests / Channel authorization / Avatars, §4 Board data flow). ACs covered: AC11–AC25, AC28 (server side), AC29 (server side), AC30 (server side). AC26/AC27 and the board UI are Plan 4.

This is **plan 3 of 5**; it builds on Plans 1–2 on `main` (workspaces, teams, `TeamPolicy::view`, i18n, UUID keys).

## Global Constraints

- All commands run through Sail: `vendor/bin/sail artisan …`, `vendor/bin/sail composer …`, `vendor/bin/sail bin pint --dirty --format agent`, `vendor/bin/sail bin phpstan analyse` (must stay at 0 errors). npm runs on the host.
- Run tests with `vendor/bin/sail artisan test --compact <path-or---filter>`. `tests/TestCase.php` already calls `withoutVite()`.
- New dependencies allowed in this plan: `laravel/reverb` (requires downgrading `guzzlehttp/guzzle` 8 → 7 via `-W`; Laravel 13 accepts both), `dicebear/core`, `dicebear/styles`. Nothing else.
- Every table has a UUID primary key (`HasUuids`); foreign keys use `foreignUuid`.
- Supported locales `en`, `fr`, `es`, `de`: every user-facing string (including error messages returned in JSON) goes through `__()` / `t()`; keys are the English text; each new key goes into all four `lang/*.json` with real translations; German informal "du". `tests/Feature/TranslationKeysTest.php` must stay green.
- No request-specific state in static properties or singletons (Octane). Static helpers must be pure.
- Migrations: `up()` only — delete the generated `down()`.
- Controllers: plural names, CRUD method names only; URLs kebab-case; route params camelCase; route names dotted.
- PHP: typed properties, return types (incl. `void`), early returns, no `else`, curly braces always, string interpolation, one trait per line, no comments that restate code. Models use `#[Fillable([...])]`.
- Tests: Pest function style, no comments, factories for models. JSON endpoints are tested with `getJson/postJson/patchJson/putJson/deleteJson`.
- After PHP changes: pint. After TS changes: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check` (`npm run check` has known pre-existing failures in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md` only).
- Commit messages: Conventional Commits, ending with exactly:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01FcMxGGHCZcDTndQCc57VPC`

## Shared conventions (read before any task)

- **Participant in a request:** `Participant::current($request)` returns the participant the middleware resolved (403 if none).
- **Denials:** `RetroGuard::phase($retro, RetroPhase ...$allowed)`, `RetroGuard::facilitator($retro, $participant)`, `RetroGuard::author($card, $participant)` throw `Illuminate\Auth\Access\AuthorizationException` with a translated message → HTTP 403 `{"message": …}`. Business-rule input errors throw `ValidationException` → 422.
- **Broadcasting:** every event extends `App\Events\Retros\RetroBroadcastEvent` and is sent with `broadcast(new XEvent(...))->toOthers();` **inside** the mutation's `DB::transaction` (events implement `ShouldDispatchAfterCommit`, so they leave only after commit). Payloads are plain arrays built at construction with viewer `null` (the "others" view). Payloads never contain `guest_token`, guest secrets, or who cast which vote.
- **Card JSON shape** (`PresentCard`): `{id, columnId, parentCardId, position, isMine, content: ?string, author: ?{id, name}}`.

## Review Focus

1. **Redaction leaks through side channels** — a card's author or content must not leak during `Writing` or in anonymous retros through any path: snapshot, broadcast payload, grouping/move payloads, action items, or the JSON response to a *different* participant. Pinned in Tasks 3, 8, 9.
2. **Guest access revoked mid-session** — after the facilitator disables guest access or regenerates the link, an existing guest cookie must stop working for every endpoint (page, snapshot, mutations, channel auth), not only the join page. Pinned in Tasks 4, 7, 11.
3. **Vote limit under concurrency and phase changes** — a participant can never exceed `votes_per_participant`, including after the limit is lowered and when votes are reassigned by grouping. Pinned in Tasks 9, 10, 11.
4. **Cross-retro IDs** — a card, column, action item or assignee id from another retro must 404/422, never mutate the other retro. Pinned in Tasks 8, 9, 12, 13.
5. **Deleted users** — a participant whose user account was deleted keeps their cards with a "Former member" name instead of breaking the snapshot. Pinned in Task 3.

---

## File Structure

```
app/
  Enums/{RetroPhase,RetroTemplate,ColumnColor}.php
  Models/{Retro,Column,Participant,Card,Vote,ActionItem}.php, Team.php (retros())
  Actions/Retros/
    CreateRetro.php            team + creator + template → retro with columns and facilitator
    RetroGuard.php             static phase / facilitator / author checks
    PresentCard.php            card → redacted array for a viewer (null = others)
    PresentActionItem.php
    BuildBoardSnapshot.php     full per-viewer board state
    ResolveParticipant.php     request + retro → member or guest participant
    GuestCookie.php            cookie name / value / parsing
    PlaceCard.php              move a top-level card to a column index, resequence
    GroupCard.php              group / ungroup incl. vote reassignment
  Events/Retros/               RetroBroadcastEvent + one class per event
  Http/Middleware/ResolveRetroParticipant.php
  Http/Controllers/
    AvatarsController.php, BroadcastAuthorizationsController.php
    TeamRetrosController.php, RetroJoinsController.php
    Retros/{RetrosController,RetroSnapshotsController,CardsController,CardPositionsController,
            CardGroupsController,CardVotesController,RetroPhasesController,RetroTimersController,
            RetroHighlightsController,RetroSettingsController,RetroGuestTokensController,
            RetroFacilitatorsController,ColumnsController,ColumnOrdersController,ActionItemsController}.php
config/broadcasting.php, config/reverb.php (installer), config/skrum.php (avatar_style)
database/migrations/…, database/factories/{Retro,Column,Participant,Card,Vote,ActionItem}Factory.php
resources/js/pages/retros/{show,join}.tsx, resources/js/pages/teams/show.tsx (retro list + create)
tests/Pest.php (retro helpers), tests/Feature/Retros/*.php
```

---

### Task 1: Retro schema, enums, models, factories

**Files:**
- Create: `app/Enums/RetroPhase.php`, `app/Enums/RetroTemplate.php`, `app/Enums/ColumnColor.php`
- Create migrations: `create_retros_table`, `create_participants_table`, `create_columns_table`, `create_cards_table`, `create_votes_table`, `create_action_items_table`, `add_foreign_keys_to_retros_table`
- Create: `app/Models/{Retro,Column,Participant,Card,Vote,ActionItem}.php`, factories for each
- Modify: `app/Models/Team.php`, `tests/Pest.php`, `lang/*.json`
- Test: `tests/Feature/Retros/RetroModelTest.php`

**Interfaces:**
- Produces:
  - `enum RetroPhase: string { Writing='writing'; Grouping='grouping'; Voting='voting'; Discussing='discussing'; Completed='completed'; }` with `next(): ?self`, `previous(): ?self`, `isAdjacentTo(self $other): bool`, `label(): string`
  - `enum ColumnColor: string { Green='green'; Red='red'; Blue='blue'; Amber='amber'; Purple='purple'; Slate='slate'; }`
  - `enum RetroTemplate: string { StartStopContinue='start_stop_continue'; MadSadGlad='mad_sad_glad'; FourLs='four_ls'; WentWellToImproveActions='went_well_to_improve_actions'; Custom='custom'; }` with `label(): string`, `columns(): array<int, array{title: string, color: ColumnColor}>` (English keys, translated at creation), `static options(): array<int, array{value: string, label: string}>`
  - Models + relations: `Team::retros()`; `Retro::{team, columns (ordered by position), participants, cards, votes, actionItems, facilitator}`, `Retro::isFacilitator(Participant): bool`; `Participant::{retro, user, cards, votes}`, `Participant::displayName(): string`, `Participant::isGuest(): bool`, `Participant::current(Request): self`; `Card::{retro, column, participant, parent, children, votes}`, `Card::isTopLevel(): bool`; `Column::{retro, cards}`; `Vote::{retro, card, participant}`; `ActionItem::{retro, assignee, createdBy}`
  - Factories: `RetroFactory` states `inPhase(RetroPhase)`, `anonymous()`, `withGuestAccess()`; `ParticipantFactory` state `guest(string $secret = 'secret')`; `ColumnFactory`, `CardFactory`, `VoteFactory`, `ActionItemFactory` (all derive their retro from given relations)
  - Test helpers in `tests/Pest.php`: `retroMember(Retro $retro): array{0: User, 1: Participant}`, `retroFacilitator(Retro $retro): array{0: User, 1: Participant}`

- [ ] **Step 1: Write the failing test**

`vendor/bin/sail artisan make:test --pest Retros/RetroModelTest`:

```php
<?php

use App\Enums\RetroPhase;
use App\Enums\RetroTemplate;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use Illuminate\Http\Request;

it('moves between adjacent phases only', function () {
    expect(RetroPhase::Writing->next())->toBe(RetroPhase::Grouping)
        ->and(RetroPhase::Writing->previous())->toBeNull()
        ->and(RetroPhase::Completed->next())->toBeNull()
        ->and(RetroPhase::Voting->isAdjacentTo(RetroPhase::Grouping))->toBeTrue()
        ->and(RetroPhase::Voting->isAdjacentTo(RetroPhase::Discussing))->toBeTrue()
        ->and(RetroPhase::Writing->isAdjacentTo(RetroPhase::Voting))->toBeFalse()
        ->and(RetroPhase::Writing->isAdjacentTo(RetroPhase::Writing))->toBeFalse();
});

it('defines template columns', function () {
    expect(array_column(RetroTemplate::StartStopContinue->columns(), 'title'))->toBe(['Start', 'Stop', 'Continue'])
        ->and(RetroTemplate::FourLs->columns())->toHaveCount(4)
        ->and(RetroTemplate::Custom->columns())->toBe([])
        ->and(RetroTemplate::options())->toHaveCount(5);
});

it('names members, guests and former members', function () {
    $member = Participant::factory()->create();
    $guest = Participant::factory()->guest()->create(['guest_name' => 'Visitor']);
    $former = Participant::factory()->create();
    $former->user->delete();

    expect($member->displayName())->toBe($member->user->name)
        ->and($member->isGuest())->toBeFalse()
        ->and($guest->displayName())->toBe('Visitor')
        ->and($guest->isGuest())->toBeTrue()
        ->and($former->fresh()->displayName())->toBe('Former member');
});

it('keeps cards of a deleted user', function () {
    $card = Card::factory()->create();

    $card->participant->user->delete();

    expect($card->fresh())->not->toBeNull();
});

it('knows its facilitator', function () {
    $retro = Retro::factory()->create();
    [, $facilitator] = retroFacilitator($retro);
    [, $member] = retroMember($retro);

    expect($retro->fresh()->isFacilitator($facilitator))->toBeTrue()
        ->and($retro->fresh()->isFacilitator($member))->toBeFalse();
});

it('builds cards inside one retro', function () {
    $card = Card::factory()->create();

    expect($card->column->retro_id)->toBe($card->retro_id)
        ->and($card->participant->retro_id)->toBe($card->retro_id)
        ->and($card->isTopLevel())->toBeTrue();
});

it('reads the participant the middleware resolved', function () {
    $participant = Participant::factory()->create();
    $request = Request::create('/');
    $request->attributes->set('participant', $participant);

    expect(Participant::current($request)->is($participant))->toBeTrue();
});

it('refuses requests without a resolved participant', function () {
    Participant::current(Request::create('/'));
})->throws(Symfony\Component\HttpKernel\Exception\HttpException::class);

it('orders columns by position', function () {
    $retro = Retro::factory()->create();
    $retro->columns()->create(['title' => 'B', 'color' => 'blue', 'position' => 1]);
    $retro->columns()->create(['title' => 'A', 'color' => 'green', 'position' => 0]);

    expect($retro->columns->pluck('title')->all())->toBe(['A', 'B']);
});

it('attaches retro helpers to the team', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    expect($retro->team->hasMember($user))->toBeTrue()
        ->and($user->belongsToWorkspace($retro->team->workspace))->toBeTrue()
        ->and(User::count())->toBeGreaterThanOrEqual(1);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/RetroModelTest.php`
Expected: FAIL — enums/models missing.

- [ ] **Step 3: Enums**

`app/Enums/RetroPhase.php`:

```php
<?php

namespace App\Enums;

enum RetroPhase: string
{
    case Writing = 'writing';
    case Grouping = 'grouping';
    case Voting = 'voting';
    case Discussing = 'discussing';
    case Completed = 'completed';

    public function next(): ?self
    {
        $cases = self::cases();
        $index = array_search($this, $cases, true);

        return $cases[$index + 1] ?? null;
    }

    public function previous(): ?self
    {
        $cases = self::cases();
        $index = array_search($this, $cases, true);

        return $cases[$index - 1] ?? null;
    }

    public function isAdjacentTo(self $other): bool
    {
        return $this->next() === $other || $this->previous() === $other;
    }

    public function label(): string
    {
        return match ($this) {
            self::Writing => __('Writing'),
            self::Grouping => __('Grouping'),
            self::Voting => __('Voting'),
            self::Discussing => __('Discussing'),
            self::Completed => __('Completed'),
        };
    }
}
```

`app/Enums/ColumnColor.php`:

```php
<?php

namespace App\Enums;

enum ColumnColor: string
{
    case Green = 'green';
    case Red = 'red';
    case Blue = 'blue';
    case Amber = 'amber';
    case Purple = 'purple';
    case Slate = 'slate';
}
```

`app/Enums/RetroTemplate.php`:

```php
<?php

namespace App\Enums;

enum RetroTemplate: string
{
    case StartStopContinue = 'start_stop_continue';
    case MadSadGlad = 'mad_sad_glad';
    case FourLs = 'four_ls';
    case WentWellToImproveActions = 'went_well_to_improve_actions';
    case Custom = 'custom';

    /**
     * @return array<int, array{
     *     value: string,
     *     label: string
     * }>
     */
    public static function options(): array
    {
        return array_map(fn (self $template) => [
            'value' => $template->value,
            'label' => $template->label(),
        ], self::cases());
    }

    public function label(): string
    {
        return match ($this) {
            self::StartStopContinue => __('Start, Stop, Continue'),
            self::MadSadGlad => __('Mad, Sad, Glad'),
            self::FourLs => __('Liked, Learned, Lacked, Longed for'),
            self::WentWellToImproveActions => __('Went well, To improve, Action ideas'),
            self::Custom => __('Custom'),
        };
    }

    /**
     * English titles; translate with __() when copying them into a retro.
     *
     * @return array<int, array{
     *     title: string,
     *     color: ColumnColor
     * }>
     */
    public function columns(): array
    {
        return match ($this) {
            self::StartStopContinue => [
                ['title' => 'Start', 'color' => ColumnColor::Green],
                ['title' => 'Stop', 'color' => ColumnColor::Red],
                ['title' => 'Continue', 'color' => ColumnColor::Blue],
            ],
            self::MadSadGlad => [
                ['title' => 'Mad', 'color' => ColumnColor::Red],
                ['title' => 'Sad', 'color' => ColumnColor::Blue],
                ['title' => 'Glad', 'color' => ColumnColor::Green],
            ],
            self::FourLs => [
                ['title' => 'Liked', 'color' => ColumnColor::Green],
                ['title' => 'Learned', 'color' => ColumnColor::Blue],
                ['title' => 'Lacked', 'color' => ColumnColor::Amber],
                ['title' => 'Longed for', 'color' => ColumnColor::Purple],
            ],
            self::WentWellToImproveActions => [
                ['title' => 'Went well', 'color' => ColumnColor::Green],
                ['title' => 'To improve', 'color' => ColumnColor::Amber],
                ['title' => 'Action ideas', 'color' => ColumnColor::Blue],
            ],
            self::Custom => [],
        };
    }
}
```

Because the column titles are passed to `__()` as variables, the key test cannot see them: add every title (`Start`, `Stop`, `Continue`, `Mad`, `Sad`, `Glad`, `Liked`, `Learned`, `Lacked`, `Longed for`, `Went well`, `To improve`, `Action ideas`) plus the template labels, phase labels and `Former member` to the four lang files by hand (skip keys that already exist).

- [ ] **Step 4: Migrations**

Create with `vendor/bin/sail artisan make:migration <name> --no-interaction` in this order and delete every `down()`:

`create_retros_table`:

```php
Schema::create('retros', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
    $table->string('title', 120);
    $table->string('template');
    $table->string('phase')->default('writing');
    $table->uuid('facilitator_participant_id')->nullable();
    $table->boolean('is_anonymous')->default(false);
    $table->unsignedSmallInteger('votes_per_participant')->default(5);
    $table->boolean('guest_access_enabled')->default(false);
    $table->string('guest_token', 64)->unique();
    $table->timestamp('timer_ends_at')->nullable();
    $table->uuid('highlighted_card_id')->nullable();
    $table->timestamp('completed_at')->nullable();
    $table->timestamps();

    $table->index(['team_id', 'created_at']);
});
```

`create_participants_table`:

```php
Schema::create('participants', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
    $table->foreignUuid('user_id')->nullable()->constrained()->nullOnDelete();
    $table->string('guest_name', 50)->nullable();
    $table->string('guest_secret_hash', 64)->nullable();
    $table->timestamps();

    $table->unique(['retro_id', 'user_id']);
});
```

`create_columns_table`:

```php
Schema::create('columns', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
    $table->string('title', 60);
    $table->string('color', 16);
    $table->unsignedInteger('position');
    $table->timestamps();
});
```

`create_cards_table`:

```php
Schema::create('cards', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
    $table->foreignUuid('column_id')->constrained()->cascadeOnDelete();
    $table->foreignUuid('participant_id')->constrained()->cascadeOnDelete();
    $table->text('content');
    $table->unsignedInteger('position')->default(0);
    $table->foreignUuid('parent_card_id')->nullable()->constrained('cards')->nullOnDelete();
    $table->timestamps();

    $table->index(['column_id', 'position']);
});
```

`create_votes_table`:

```php
Schema::create('votes', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
    $table->foreignUuid('card_id')->constrained()->cascadeOnDelete();
    $table->foreignUuid('participant_id')->constrained()->cascadeOnDelete();
    $table->timestamps();

    $table->index(['retro_id', 'participant_id']);
});
```

`create_action_items_table`:

```php
Schema::create('action_items', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
    $table->string('content', 500);
    $table->foreignUuid('assignee_participant_id')->nullable()->constrained('participants')->nullOnDelete();
    $table->foreignUuid('created_by_participant_id')->constrained('participants')->cascadeOnDelete();
    $table->boolean('is_done')->default(false);
    $table->timestamps();
});
```

`add_foreign_keys_to_retros_table`:

```php
Schema::table('retros', function (Blueprint $table) {
    $table->foreign('facilitator_participant_id')->references('id')->on('participants')->nullOnDelete();
    $table->foreign('highlighted_card_id')->references('id')->on('cards')->nullOnDelete();
});
```

- [ ] **Step 5: Models**

`app/Models/Retro.php`:

```php
<?php

namespace App\Models;

use App\Enums\RetroPhase;
use App\Enums\RetroTemplate;
use Database\Factories\RetroFactory;
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
 * @property string $title
 * @property RetroTemplate $template
 * @property RetroPhase $phase
 * @property string|null $facilitator_participant_id
 * @property bool $is_anonymous
 * @property int $votes_per_participant
 * @property bool $guest_access_enabled
 * @property string $guest_token
 * @property Carbon|null $timer_ends_at
 * @property string|null $highlighted_card_id
 * @property Carbon|null $completed_at
 * @property Carbon|null $created_at
 * @property-read Team $team
 */
#[Fillable([
    'title', 'template', 'phase', 'facilitator_participant_id', 'is_anonymous', 'votes_per_participant',
    'guest_access_enabled', 'guest_token', 'timer_ends_at', 'highlighted_card_id', 'completed_at',
])]
#[Hidden(['guest_token'])]
class Retro extends Model
{
    /** @use HasFactory<RetroFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /** @return HasMany<Column, $this> */
    public function columns(): HasMany
    {
        return $this->hasMany(Column::class)->orderBy('position');
    }

    /** @return HasMany<Participant, $this> */
    public function participants(): HasMany
    {
        return $this->hasMany(Participant::class);
    }

    /** @return HasMany<Card, $this> */
    public function cards(): HasMany
    {
        return $this->hasMany(Card::class);
    }

    /** @return HasMany<Vote, $this> */
    public function votes(): HasMany
    {
        return $this->hasMany(Vote::class);
    }

    /** @return HasMany<ActionItem, $this> */
    public function actionItems(): HasMany
    {
        return $this->hasMany(ActionItem::class);
    }

    /** @return BelongsTo<Participant, $this> */
    public function facilitator(): BelongsTo
    {
        return $this->belongsTo(Participant::class, 'facilitator_participant_id');
    }

    public function isFacilitator(Participant $participant): bool
    {
        return $this->facilitator_participant_id === $participant->id;
    }

    protected function casts(): array
    {
        return [
            'template' => RetroTemplate::class,
            'phase' => RetroPhase::class,
            'is_anonymous' => 'boolean',
            'guest_access_enabled' => 'boolean',
            'votes_per_participant' => 'integer',
            'timer_ends_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }
}
```

`app/Models/Participant.php`:

```php
<?php

namespace App\Models;

use Database\Factories\ParticipantFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Request;

/**
 * @property string $id
 * @property string $retro_id
 * @property string|null $user_id
 * @property string|null $guest_name
 * @property string|null $guest_secret_hash
 * @property-read Retro $retro
 * @property-read User|null $user
 */
#[Fillable(['retro_id', 'user_id', 'guest_name', 'guest_secret_hash'])]
#[Hidden(['guest_secret_hash'])]
class Participant extends Model
{
    /** @use HasFactory<ParticipantFactory> */
    use HasFactory;

    use HasUuids;

    public static function current(Request $request): self
    {
        $participant = $request->attributes->get('participant');

        abort_unless($participant instanceof self, 403);

        return $participant;
    }

    /** @return BelongsTo<Retro, $this> */
    public function retro(): BelongsTo
    {
        return $this->belongsTo(Retro::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<Card, $this> */
    public function cards(): HasMany
    {
        return $this->hasMany(Card::class);
    }

    /** @return HasMany<Vote, $this> */
    public function votes(): HasMany
    {
        return $this->hasMany(Vote::class);
    }

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
}
```

`app/Models/Column.php`:

```php
<?php

namespace App\Models;

use App\Enums\ColumnColor;
use Database\Factories\ColumnFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $id
 * @property string $retro_id
 * @property string $title
 * @property ColumnColor $color
 * @property int $position
 */
#[Fillable(['title', 'color', 'position'])]
class Column extends Model
{
    /** @use HasFactory<ColumnFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Retro, $this> */
    public function retro(): BelongsTo
    {
        return $this->belongsTo(Retro::class);
    }

    /** @return HasMany<Card, $this> */
    public function cards(): HasMany
    {
        return $this->hasMany(Card::class);
    }

    protected function casts(): array
    {
        return [
            'color' => ColumnColor::class,
            'position' => 'integer',
        ];
    }
}
```

`app/Models/Card.php`:

```php
<?php

namespace App\Models;

use Database\Factories\CardFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $id
 * @property string $retro_id
 * @property string $column_id
 * @property string $participant_id
 * @property string $content
 * @property int $position
 * @property string|null $parent_card_id
 * @property-read Participant $participant
 */
#[Fillable(['column_id', 'participant_id', 'content', 'position', 'parent_card_id'])]
class Card extends Model
{
    /** @use HasFactory<CardFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Retro, $this> */
    public function retro(): BelongsTo
    {
        return $this->belongsTo(Retro::class);
    }

    /** @return BelongsTo<Column, $this> */
    public function column(): BelongsTo
    {
        return $this->belongsTo(Column::class);
    }

    /** @return BelongsTo<Participant, $this> */
    public function participant(): BelongsTo
    {
        return $this->belongsTo(Participant::class);
    }

    /** @return BelongsTo<Card, $this> */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Card::class, 'parent_card_id');
    }

    /** @return HasMany<Card, $this> */
    public function children(): HasMany
    {
        return $this->hasMany(Card::class, 'parent_card_id');
    }

    /** @return HasMany<Vote, $this> */
    public function votes(): HasMany
    {
        return $this->hasMany(Vote::class);
    }

    public function isTopLevel(): bool
    {
        return $this->parent_card_id === null;
    }

    protected function casts(): array
    {
        return [
            'position' => 'integer',
        ];
    }
}
```

`app/Models/Vote.php`:

```php
<?php

namespace App\Models;

use Database\Factories\VoteFactory;
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
 */
#[Fillable(['card_id', 'participant_id'])]
class Vote extends Model
{
    /** @use HasFactory<VoteFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Retro, $this> */
    public function retro(): BelongsTo
    {
        return $this->belongsTo(Retro::class);
    }

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

`app/Models/ActionItem.php`:

```php
<?php

namespace App\Models;

use Database\Factories\ActionItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $retro_id
 * @property string $content
 * @property string|null $assignee_participant_id
 * @property string $created_by_participant_id
 * @property bool $is_done
 * @property-read Participant|null $assignee
 */
#[Fillable(['content', 'assignee_participant_id', 'created_by_participant_id', 'is_done'])]
class ActionItem extends Model
{
    /** @use HasFactory<ActionItemFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Retro, $this> */
    public function retro(): BelongsTo
    {
        return $this->belongsTo(Retro::class);
    }

    /** @return BelongsTo<Participant, $this> */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(Participant::class, 'assignee_participant_id');
    }

    /** @return BelongsTo<Participant, $this> */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(Participant::class, 'created_by_participant_id');
    }

    protected function casts(): array
    {
        return [
            'is_done' => 'boolean',
        ];
    }
}
```

`app/Models/Team.php` — add:

```php
/** @return HasMany<Retro, $this> */
public function retros(): HasMany
{
    return $this->hasMany(Retro::class);
}
```

- [ ] **Step 6: Factories**

`RetroFactory`:

```php
public function definition(): array
{
    return [
        'team_id' => Team::factory(),
        'title' => fake()->sentence(3),
        'template' => RetroTemplate::StartStopContinue,
        'phase' => RetroPhase::Writing,
        'guest_token' => Str::random(40),
    ];
}

public function inPhase(RetroPhase $phase): static
{
    return $this->state(fn () => ['phase' => $phase]);
}

public function anonymous(): static
{
    return $this->state(fn () => ['is_anonymous' => true]);
}

public function withGuestAccess(): static
{
    return $this->state(fn () => ['guest_access_enabled' => true]);
}
```

`ParticipantFactory`:

```php
public function definition(): array
{
    return [
        'retro_id' => Retro::factory(),
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
```

`ColumnFactory`:

```php
public function definition(): array
{
    return [
        'retro_id' => Retro::factory(),
        'title' => fake()->word(),
        'color' => ColumnColor::Green,
        'position' => 0,
    ];
}
```

`CardFactory` (column and author are created inside the card's retro):

```php
public function definition(): array
{
    return [
        'retro_id' => Retro::factory(),
        'column_id' => fn (array $attributes) => Column::factory()->create(['retro_id' => $attributes['retro_id']])->id,
        'participant_id' => fn (array $attributes) => Participant::factory()->create(['retro_id' => $attributes['retro_id']])->id,
        'content' => fake()->sentence(),
        'position' => 0,
    ];
}
```

`VoteFactory`:

```php
public function definition(): array
{
    return [
        'retro_id' => Retro::factory(),
        'card_id' => fn (array $attributes) => Card::factory()->create(['retro_id' => $attributes['retro_id']])->id,
        'participant_id' => fn (array $attributes) => Participant::factory()->create(['retro_id' => $attributes['retro_id']])->id,
    ];
}
```

`ActionItemFactory`:

```php
public function definition(): array
{
    return [
        'retro_id' => Retro::factory(),
        'content' => fake()->sentence(),
        'created_by_participant_id' => fn (array $attributes) => Participant::factory()->create(['retro_id' => $attributes['retro_id']])->id,
        'is_done' => false,
    ];
}
```

Because `retro_id` is not fillable on children, factories set it directly (factories bypass fillable). When a test passes an explicit model through `->for($retro)` the closures receive that `retro_id`.

- [ ] **Step 7: Test helpers**

Replace the placeholder `something()` function in `tests/Pest.php` with:

```php
use App\Enums\WorkspaceRole;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;

/**
 * @return array{0: User, 1: Participant}
 */
function retroMember(Retro $retro): array
{
    $user = User::factory()->create();
    $retro->team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
    $retro->team->members()->attach($user);

    $participant = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $user->id]);

    return [$user, $participant];
}

/**
 * @return array{0: User, 1: Participant}
 */
function retroFacilitator(Retro $retro): array
{
    [$user, $participant] = retroMember($retro);

    $retro->forceFill(['facilitator_participant_id' => $participant->id])->save();

    return [$user, $participant];
}
```

(Keep the `use` statements at the top of `tests/Pest.php` with the existing ones.)

- [ ] **Step 8: Run tests**

Run: `vendor/bin/sail artisan migrate --no-interaction && vendor/bin/sail artisan test --compact tests/Feature/Retros tests/Feature/UuidPrimaryKeysTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse
git add -A && git commit -m "feat: add retro domain schema and models

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FcMxGGHCZcDTndQCc57VPC"
```

---

### Task 2: DiceBear avatars

**Files:**
- Create: `app/Http/Controllers/AvatarsController.php`
- Modify: `config/skrum.php`, `.env.example`, `routes/web.php`, `app/Models/Participant.php`
- Test: `tests/Feature/Retros/AvatarsTest.php`

**Interfaces:**
- Consumes: `Participant` (Task 1).
- Produces: route `avatars.show` (GET `/avatars/{seed}.svg`, `seed` = 32 lowercase hex chars); `Participant::avatarSeed(): string` (HMAC of the user id for members, participant id for guests), `Participant::avatarUrl(): string`; config `skrum.avatar_style` (default `thumbs`).

- [ ] **Step 1: Install**

```bash
vendor/bin/sail composer require dicebear/core dicebear/styles
```

- [ ] **Step 2: Write the failing test**

`vendor/bin/sail artisan make:test --pest Retros/AvatarsTest`:

```php
<?php

use App\Models\Participant;
use App\Models\User;

it('renders a cacheable svg avatar', function () {
    $response = $this->get(route('avatars.show', str_repeat('a', 32)));

    $response->assertOk()
        ->assertHeader('Content-Type', 'image/svg+xml')
        ->assertHeader('Cache-Control', 'immutable, max-age=31536000, public');

    expect($response->getContent())->toStartWith('<svg');
});

it('renders the same avatar for the same seed', function () {
    $seed = str_repeat('b', 32);

    expect($this->get(route('avatars.show', $seed))->getContent())
        ->toBe($this->get(route('avatars.show', $seed))->getContent());
});

it('rejects malformed seeds', function (string $seed) {
    $this->get("/avatars/{$seed}.svg")->assertNotFound();
})->with(['short', str_repeat('Z', 32), str_repeat('a', 33)]);

it('falls back to the default style when the configured one does not exist', function () {
    config(['skrum.avatar_style' => '../../etc/passwd']);

    $this->get(route('avatars.show', str_repeat('c', 32)))->assertOk();
});

it('gives a member the same avatar in every retro', function () {
    $user = User::factory()->create();
    $first = Participant::factory()->create(['user_id' => $user->id]);
    $second = Participant::factory()->create(['user_id' => $user->id]);

    expect($first->avatarSeed())->toBe($second->avatarSeed())
        ->and($first->avatarSeed())->toMatch('/^[a-f0-9]{32}$/')
        ->and($first->avatarSeed())->not->toContain($user->id)
        ->and($first->avatarUrl())->toBe(route('avatars.show', $first->avatarSeed()));
});

it('gives guests their own avatar', function () {
    $first = Participant::factory()->guest()->create();
    $second = Participant::factory()->guest()->create();

    expect($first->avatarSeed())->not->toBe($second->avatarSeed());
});
```

- [ ] **Step 3: Run to verify failure**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/AvatarsTest.php`
Expected: FAIL — route missing.

- [ ] **Step 4: Implement**

`config/skrum.php` — add `'avatar_style' => env('SKRUM_AVATAR_STYLE', 'thumbs'),`. `.env.example` — add `SKRUM_AVATAR_STYLE=thumbs` with a comment `# DiceBear style (CC0 styles need no attribution; thumbs is CC0)`.

`app/Http/Controllers/AvatarsController.php`:

```php
<?php

namespace App\Http\Controllers;

use DiceBear\Avatar;
use DiceBear\Style;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;

class AvatarsController extends Controller
{
    private const DefaultStyle = 'thumbs';

    public function show(string $seed): Response
    {
        $style = $this->style();

        $svg = Cache::rememberForever("avatars.{$style}.{$seed}", function () use ($style, $seed): string {
            $definition = Style::fromJson((string) file_get_contents($this->stylePath($style)));

            return (string) new Avatar($definition, ['seed' => $seed]);
        });

        return response($svg, 200, [
            'Content-Type' => 'image/svg+xml',
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }

    private function style(): string
    {
        $configured = (string) config('skrum.avatar_style');

        if (preg_match('/^[a-z0-9-]+$/', $configured) !== 1) {
            return self::DefaultStyle;
        }

        if (! is_file($this->stylePath($configured))) {
            return self::DefaultStyle;
        }

        return $configured;
    }

    private function stylePath(string $style): string
    {
        return base_path("vendor/dicebear/styles/src/{$style}.json");
    }
}
```

`routes/web.php` — add (public): `Route::get('avatars/{seed}.svg', [AvatarsController::class, 'show'])->where('seed', '[a-f0-9]{32}')->name('avatars.show');`

`Participant.php` — add:

```php
public function avatarSeed(): string
{
    $identity = $this->user_id ?? $this->id;

    return substr(hash_hmac('sha256', $identity, (string) config('app.key')), 0, 32);
}

public function avatarUrl(): string
{
    return route('avatars.show', $this->avatarSeed());
}
```

Laravel normalises the `Cache-Control` header order; if the assertion fails only on ordering, assert on the actual normalised string Laravel produces and note it.

- [ ] **Step 5: Run tests, commit**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/AvatarsTest.php` → PASS.

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse
git add -A && git commit -m "feat: serve dicebear avatars for participants

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FcMxGGHCZcDTndQCc57VPC"
```

---

### Task 3: Redaction — card presentation and board snapshot

**Files:**
- Create: `app/Actions/Retros/PresentCard.php`, `app/Actions/Retros/PresentActionItem.php`, `app/Actions/Retros/BuildBoardSnapshot.php`
- Test: `tests/Feature/Retros/BoardSnapshotTest.php`

**Interfaces:**
- Consumes: models (Task 1), `Participant::avatarUrl()` (Task 2), route `teams.show`.
- Produces:
  - `PresentCard::handle(Card $card, Retro $retro, ?Participant $viewer): array{id, columnId, parentCardId, position, isMine, content: ?string, author: ?array{id: string, name: string}}` — viewer `null` = "another participant".
  - `PresentActionItem::handle(ActionItem $item): array{id, content, isDone, assignee: ?array{id: string, name: string}}`
  - `BuildBoardSnapshot::handle(Retro $retro, Participant $viewer): array` with keys `retro`, `viewer`, `columns`, `cards` (each card + `votes: ?int`, `myVotes: int`), `participants`, `actionItems`, `votesCast: ?int`, `links` — exact shape in the code below. Task 6 adds `retro.guestUrl`.

Redaction rules (spec §4): Writing → others see no content and no author; anonymous → others never see the author; who voted never exposed; totals only in Discussing/Completed; own votes/remaining always to the viewer; `votesCast` only in Voting.

- [ ] **Step 1: Write the failing test**

`vendor/bin/sail artisan make:test --pest Retros/BoardSnapshotTest`:

```php
<?php

use App\Actions\Retros\BuildBoardSnapshot;
use App\Actions\Retros\PresentCard;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Vote;

function snapshotFor(Retro $retro, Participant $viewer): array
{
    return app(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer);
}

function snapshotCard(array $snapshot, Card $card): array
{
    return collect($snapshot['cards'])->firstWhere('id', $card->id);
}

it('hides other participants cards while writing', function () {
    $retro = Retro::factory()->create();
    [, $viewer] = retroMember($retro);
    $othersCard = Card::factory()->create(['retro_id' => $retro->id, 'content' => 'secret thought']);
    $ownCard = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $viewer->id, 'content' => 'mine']);

    $snapshot = snapshotFor($retro, $viewer);

    expect(snapshotCard($snapshot, $othersCard))->toMatchArray(['content' => null, 'author' => null, 'isMine' => false])
        ->and(snapshotCard($snapshot, $ownCard))->toMatchArray(['content' => 'mine', 'isMine' => true])
        ->and(json_encode($snapshot))->not->toContain('secret thought')
        ->and(json_encode($snapshot['cards']))->not->toContain($othersCard->participant_id);
});

it('reveals content and authors after writing', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [, $viewer] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'content' => 'revealed']);

    expect(snapshotCard(snapshotFor($retro, $viewer), $card))->toMatchArray([
        'content' => 'revealed',
        'author' => ['id' => $card->participant_id, 'name' => $card->participant->displayName()],
    ]);
});

it('never reveals authors in anonymous retros', function (RetroPhase $phase) {
    $retro = Retro::factory()->inPhase($phase)->anonymous()->create();
    [, $viewer] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    $snapshot = snapshotFor($retro, $viewer);

    expect(snapshotCard($snapshot, $card)['author'])->toBeNull()
        ->and(json_encode($snapshot['cards']))->not->toContain($card->participant_id);
})->with([RetroPhase::Grouping, RetroPhase::Voting, RetroPhase::Discussing, RetroPhase::Completed]);

it('presents cards for other participants when there is no viewer', function () {
    $retro = Retro::factory()->create();
    $card = Card::factory()->create(['retro_id' => $retro->id, 'content' => 'hidden']);

    expect(app(PresentCard::class)->handle($card, $retro, null))
        ->toMatchArray(['content' => null, 'author' => null, 'isMine' => false]);
});

it('hides vote totals until discussing but always shows own votes', function (RetroPhase $phase, ?int $expectedTotal) {
    $retro = Retro::factory()->inPhase($phase)->create();
    [, $viewer] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $viewer->id]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $snapshot = snapshotFor($retro, $viewer);

    expect(snapshotCard($snapshot, $card))->toMatchArray(['votes' => $expectedTotal, 'myVotes' => 2])
        ->and($snapshot['viewer']['remainingVotes'])->toBe(3);
})->with([
    'voting' => [RetroPhase::Voting, null],
    'discussing' => [RetroPhase::Discussing, 3],
    'completed' => [RetroPhase::Completed, 3],
]);

it('reports only the overall vote count while voting', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [, $viewer] = retroMember($retro);
    Vote::factory()->count(4)->create(['retro_id' => $retro->id]);

    $snapshot = snapshotFor($retro, $viewer);

    expect($snapshot['votesCast'])->toBe(4)
        ->and(json_encode($snapshot))->not->toContain('participant_id');
});

it('describes the viewer, participants, columns and links', function () {
    $retro = Retro::factory()->create();
    [, $facilitator] = retroFacilitator($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Visitor']);

    $snapshot = snapshotFor($retro, $facilitator);
    $guestSnapshot = snapshotFor($retro, $guest);

    expect($snapshot['viewer'])->toMatchArray(['participantId' => $facilitator->id, 'isFacilitator' => true, 'isGuest' => false])
        ->and($snapshot['retro'])->toMatchArray(['id' => $retro->id, 'phase' => 'writing', 'isAnonymous' => false, 'votesPerParticipant' => 5])
        ->and($snapshot['retro'])->not->toHaveKey('guestToken')
        ->and(collect($snapshot['participants'])->firstWhere('id', $guest->id))->toMatchArray(['name' => 'Visitor', 'isGuest' => true, 'avatarUrl' => $guest->avatarUrl()])
        ->and($snapshot['links']['team'])->toBe(route('teams.show', [$retro->team->workspace, $retro->team]))
        ->and($guestSnapshot['links']['team'])->toBeNull()
        ->and(json_encode($snapshot))->not->toContain($retro->guest_token);
});

it('keeps cards of deleted users readable', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [, $viewer] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    $card->participant->user->delete();

    expect(snapshotCard(snapshotFor($retro, $viewer), $card)['author']['name'])->toBe('Former member');
});

it('lists action items with assignees', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [, $viewer] = retroMember($retro);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'assignee_participant_id' => $viewer->id, 'content' => 'Fix CI']);

    expect(snapshotFor($retro, $viewer)['actionItems'])->toBe([[
        'id' => $item->id,
        'content' => 'Fix CI',
        'isDone' => false,
        'assignee' => ['id' => $viewer->id, 'name' => $viewer->displayName()],
    ]]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/BoardSnapshotTest.php`
Expected: FAIL — classes missing.

- [ ] **Step 3: Implement**

`app/Actions/Retros/PresentCard.php`:

```php
<?php

namespace App\Actions\Retros;

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;

class PresentCard
{
    /**
     * @return array{
     *     id: string,
     *     columnId: string,
     *     parentCardId: ?string,
     *     position: int,
     *     isMine: bool,
     *     content: ?string,
     *     author: ?array{id: string, name: string}
     * }
     */
    public function handle(Card $card, Retro $retro, ?Participant $viewer): array
    {
        $isMine = $viewer !== null && $card->participant_id === $viewer->id;
        $isHidden = ! $isMine && $retro->phase === RetroPhase::Writing;
        $showsAuthor = ! $isHidden && ($isMine || ! $retro->is_anonymous);

        return [
            'id' => $card->id,
            'columnId' => $card->column_id,
            'parentCardId' => $card->parent_card_id,
            'position' => $card->position,
            'isMine' => $isMine,
            'content' => $isHidden ? null : $card->content,
            'author' => $showsAuthor
                ? ['id' => $card->participant_id, 'name' => $card->participant->displayName()]
                : null,
        ];
    }
}
```

`app/Actions/Retros/PresentActionItem.php`:

```php
<?php

namespace App\Actions\Retros;

use App\Models\ActionItem;

class PresentActionItem
{
    /**
     * @return array{
     *     id: string,
     *     content: string,
     *     isDone: bool,
     *     assignee: ?array{id: string, name: string}
     * }
     */
    public function handle(ActionItem $item): array
    {
        return [
            'id' => $item->id,
            'content' => $item->content,
            'isDone' => $item->is_done,
            'assignee' => $item->assignee === null
                ? null
                : ['id' => $item->assignee->id, 'name' => $item->assignee->displayName()],
        ];
    }
}
```

`app/Actions/Retros/BuildBoardSnapshot.php`:

```php
<?php

namespace App\Actions\Retros;

use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;

class BuildBoardSnapshot
{
    public function __construct(
        private PresentCard $presentCard,
        private PresentActionItem $presentActionItem,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(Retro $retro, Participant $viewer): array
    {
        $retro->loadMissing([
            'team.workspace',
            'columns',
            'participants.user',
            'cards.participant.user',
            'actionItems.assignee.user',
        ]);

        $showsTotals = in_array($retro->phase, [RetroPhase::Discussing, RetroPhase::Completed], true);

        $voteTotals = $retro->votes()
            ->selectRaw('card_id, count(*) as total')
            ->groupBy('card_id')
            ->pluck('total', 'card_id');

        $myVotes = $retro->votes()
            ->where('participant_id', $viewer->id)
            ->selectRaw('card_id, count(*) as total')
            ->groupBy('card_id')
            ->pluck('total', 'card_id');

        return [
            'retro' => [
                'id' => $retro->id,
                'title' => $retro->title,
                'template' => $retro->template->value,
                'phase' => $retro->phase->value,
                'isAnonymous' => $retro->is_anonymous,
                'votesPerParticipant' => $retro->votes_per_participant,
                'guestAccessEnabled' => $retro->guest_access_enabled,
                'facilitatorParticipantId' => $retro->facilitator_participant_id,
                'timerEndsAt' => $retro->timer_ends_at?->toIso8601String(),
                'highlightedCardId' => $retro->highlighted_card_id,
                'completedAt' => $retro->completed_at?->toIso8601String(),
            ],
            'viewer' => [
                'participantId' => $viewer->id,
                'isFacilitator' => $retro->isFacilitator($viewer),
                'isGuest' => $viewer->isGuest(),
                'remainingVotes' => max(0, $retro->votes_per_participant - (int) $myVotes->sum()),
            ],
            'columns' => $retro->columns->map(fn (Column $column) => [
                'id' => $column->id,
                'title' => $column->title,
                'color' => $column->color->value,
                'position' => $column->position,
            ])->values()->all(),
            'cards' => $retro->cards->sortBy('position')->map(fn (Card $card) => [
                ...$this->presentCard->handle($card, $retro, $viewer),
                'votes' => $showsTotals ? (int) ($voteTotals[$card->id] ?? 0) : null,
                'myVotes' => (int) ($myVotes[$card->id] ?? 0),
            ])->values()->all(),
            'participants' => $retro->participants->map(fn (Participant $participant) => [
                'id' => $participant->id,
                'name' => $participant->displayName(),
                'avatarUrl' => $participant->avatarUrl(),
                'isGuest' => $participant->isGuest(),
            ])->values()->all(),
            'actionItems' => $retro->actionItems->sortBy('created_at')
                ->map(fn (ActionItem $item) => $this->presentActionItem->handle($item))
                ->values()->all(),
            'votesCast' => $retro->phase === RetroPhase::Voting ? (int) $voteTotals->sum() : null,
            'links' => [
                'team' => $viewer->isGuest() ? null : route('teams.show', [$retro->team->workspace, $retro->team]),
            ],
        ];
    }
}
```

- [ ] **Step 4: Run tests, commit**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/BoardSnapshotTest.php` → PASS.

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse
git add -A && git commit -m "feat: build redacted per-viewer board snapshots

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FcMxGGHCZcDTndQCc57VPC"
```

---

### Task 4: Participant resolution, board page and snapshot endpoint

**Files:**
- Create: `app/Actions/Retros/GuestCookie.php`, `app/Actions/Retros/ResolveParticipant.php`, `app/Actions/Retros/RetroGuard.php`, `app/Http/Middleware/ResolveRetroParticipant.php`, `app/Http/Controllers/Retros/RetrosController.php`, `app/Http/Controllers/Retros/RetroSnapshotsController.php`, `resources/js/pages/retros/show.tsx`
- Modify: `routes/web.php`, `resources/js/app.tsx`, `tests/Pest.php`, `lang/*.json`
- Test: `tests/Feature/Retros/RetroAccessTest.php`, `tests/Feature/Retros/RetroGuardTest.php`

**Interfaces:**
- Consumes: `BuildBoardSnapshot` (Task 3), `TeamPolicy::view` (Plan 1).
- Produces:
  - `GuestCookie::name(string $retroId): string` (`retro_guest_{retroId}`), `GuestCookie::make(Participant $participant, string $secret): Symfony\Component\HttpFoundation\Cookie` (30 days), `GuestCookie::parse(?string $value): ?array{0: string, 1: string}`
  - `ResolveParticipant::handle(Request $request, Retro $retro): ?Participant` — logged-in user allowed to view the team → their participant (created on first visit); otherwise a guest participant from a valid cookie **only while guest access is enabled**; else `null`.
  - Middleware `ResolveRetroParticipant` → sets request attribute `participant`; no participant → redirect to login for logged-out page visits, 403 otherwise.
  - `RetroGuard::phase(Retro, RetroPhase ...)`, `RetroGuard::facilitator(Retro, Participant)`, `RetroGuard::author(Card, Participant)` — throw `AuthorizationException` with translated messages.
  - Route group `Route::prefix('retros/{retro}')->middleware(ResolveRetroParticipant::class)->scopeBindings()` with `retros.show` (GET `/retros/{retro}`, Inertia `retros/show`, prop `snapshot`) and `retros.snapshot.show` (GET `/retros/{retro}/snapshot`, JSON). **Every later board route goes inside this group.**
  - Test helper `retroGuestCookie(Participant $participant, string $secret = 'secret'): array<string, string>` for `withCookies()`.

- [ ] **Step 1: Write the failing tests**

`vendor/bin/sail artisan make:test --pest Retros/RetroAccessTest`:

```php
<?php

use App\Enums\WorkspaceRole;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use App\Models\Workspace;
use Inertia\Testing\AssertableInertia as Assert;

it('shows the board to team members and creates their participant', function () {
    $retro = Retro::factory()->create();
    $user = User::factory()->create();
    $retro->team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
    $retro->team->members()->attach($user);

    $this->actingAs($user)
        ->get(route('retros.show', $retro))
        ->assertInertia(fn (Assert $page) => $page
            ->component('retros/show')
            ->where('snapshot.retro.id', $retro->id)
            ->where('snapshot.viewer.isGuest', false));

    expect($retro->participants()->where('user_id', $user->id)->count())->toBe(1);

    $this->actingAs($user)->get(route('retros.show', $retro));

    expect($retro->participants()->where('user_id', $user->id)->count())->toBe(1);
});

it('lets workspace managers open any team retro', function () {
    $retro = Retro::factory()->create();
    $admin = User::factory()->create();
    $retro->team->workspace->members()->attach($admin, ['role' => WorkspaceRole::Admin->value]);

    $this->actingAs($admin)->get(route('retros.show', $retro))->assertOk();
});

it('forbids members of the workspace outside the team', function () {
    $retro = Retro::factory()->create();
    $member = User::factory()->create();
    $retro->team->workspace->members()->attach($member, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($member)->get(route('retros.show', $retro))->assertForbidden();
    $this->actingAs($member)->getJson(route('retros.snapshot.show', $retro))->assertForbidden();
});

it('sends logged out visitors to the login page', function () {
    $this->get(route('retros.show', Retro::factory()->create()))->assertRedirect(route('login'));
});

it('answers json requests from strangers with 403', function () {
    $this->getJson(route('retros.snapshot.show', Retro::factory()->create()))->assertForbidden();
});

it('recognises a guest by cookie while guest access is enabled', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    $guest = Participant::factory()->guest('s3cret')->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest, 's3cret'))
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertOk()
        ->assertJsonPath('viewer.participantId', $guest->id)
        ->assertJsonPath('viewer.isGuest', true);
});

it('rejects guests once guest access is disabled', function () {
    $retro = Retro::factory()->create();
    $guest = Participant::factory()->guest('s3cret')->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest, 's3cret'))
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertForbidden();
});

it('rejects forged or foreign guest cookies', function (Closure $cookie) {
    $retro = Retro::factory()->withGuestAccess()->create();
    $guest = Participant::factory()->guest('s3cret')->create(['retro_id' => $retro->id]);
    $otherRetroGuest = Participant::factory()->guest('s3cret')->create();

    $this->withCookies($cookie($retro, $guest, $otherRetroGuest))
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertForbidden();
})->with([
    'wrong secret' => fn () => fn ($retro, $guest) => retroGuestCookie($guest, 'nope'),
    'garbage' => fn () => fn ($retro) => ['retro_guest_'.$retro->id => 'not-a-uuid|x'],
    'other retro participant' => fn () => fn ($retro, $guest, $other) => ['retro_guest_'.$retro->id => $other->id.'|s3cret'],
]);

it('keeps guests out of workspace pages', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))
        ->get(route('workspaces.show', $retro->team->workspace))
        ->assertRedirect(route('login'));
});

it('returns 404 for unknown retros', function () {
    $this->actingAs(User::factory()->create())
        ->get('/retros/'.fake()->uuid())
        ->assertNotFound();
});

it('returns 404 for malformed retro ids', function () {
    $this->actingAs(User::factory()->create())
        ->get('/retros/not-a-uuid')
        ->assertNotFound();
});

it('does not let one workspace reach another workspace retro', function () {
    $retro = Retro::factory()->create();
    $owner = User::factory()->create();
    Workspace::factory()->withMember($owner, WorkspaceRole::Owner)->create();

    $this->actingAs($owner)->get(route('retros.show', $retro))->assertForbidden();
});
```

`vendor/bin/sail artisan make:test --pest Retros/RetroGuardTest`:

```php
<?php

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Auth\Access\AuthorizationException;

it('allows listed phases and refuses others with a translated message', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->make();

    RetroGuard::phase($retro, RetroPhase::Voting, RetroPhase::Discussing);

    expect(fn () => RetroGuard::phase($retro, RetroPhase::Writing))
        ->toThrow(AuthorizationException::class, 'This action is not available in the current phase.');
});

it('allows only the facilitator', function () {
    $retro = Retro::factory()->create();
    [, $facilitator] = retroFacilitator($retro);
    [, $member] = retroMember($retro);

    RetroGuard::facilitator($retro->fresh(), $facilitator);

    expect(fn () => RetroGuard::facilitator($retro->fresh(), $member))
        ->toThrow(AuthorizationException::class, 'Only the facilitator can do this.');
});

it('allows only the author of a card', function () {
    $card = Card::factory()->create();
    $other = Participant::factory()->create(['retro_id' => $card->retro_id]);

    RetroGuard::author($card, $card->participant);

    expect(fn () => RetroGuard::author($card, $other))
        ->toThrow(AuthorizationException::class, 'You can only change your own cards.');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/RetroAccessTest.php tests/Feature/Retros/RetroGuardTest.php`
Expected: FAIL.

- [ ] **Step 3: Implement**

`app/Actions/Retros/GuestCookie.php`:

```php
<?php

namespace App\Actions\Retros;

use App\Models\Participant;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Cookie;

class GuestCookie
{
    private const LifetimeMinutes = 60 * 24 * 30;

    public static function name(string $retroId): string
    {
        return "retro_guest_{$retroId}";
    }

    public static function make(Participant $participant, string $secret): Cookie
    {
        return cookie(self::name($participant->retro_id), "{$participant->id}|{$secret}", self::LifetimeMinutes);
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

`app/Actions/Retros/ResolveParticipant.php`:

```php
<?php

namespace App\Actions\Retros;

use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\Request;

class ResolveParticipant
{
    public function handle(Request $request, Retro $retro): ?Participant
    {
        $user = $request->user();

        if ($user !== null && $user->can('view', $retro->team)) {
            return Participant::query()->firstOrCreate([
                'retro_id' => $retro->id,
                'user_id' => $user->id,
            ]);
        }

        return $this->guest($request, $retro);
    }

    private function guest(Request $request, Retro $retro): ?Participant
    {
        if (! $retro->guest_access_enabled) {
            return null;
        }

        $credentials = GuestCookie::parse($request->cookie(GuestCookie::name($retro->id)));

        if ($credentials === null) {
            return null;
        }

        [$participantId, $secret] = $credentials;

        $participant = $retro->participants()
            ->whereKey($participantId)
            ->whereNull('user_id')
            ->whereNotNull('guest_secret_hash')
            ->first();

        if ($participant === null) {
            return null;
        }

        if (! hash_equals((string) $participant->guest_secret_hash, hash('sha256', $secret))) {
            return null;
        }

        return $participant;
    }
}
```

`firstOrCreate` needs `retro_id` to be fillable on `Participant` — Task 1 already lists it (it is only ever set by server code).

`app/Actions/Retros/RetroGuard.php`:

```php
<?php

namespace App\Actions\Retros;

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Auth\Access\AuthorizationException;

class RetroGuard
{
    public static function phase(Retro $retro, RetroPhase ...$allowed): void
    {
        if (in_array($retro->phase, $allowed, true)) {
            return;
        }

        throw new AuthorizationException(__('This action is not available in the current phase.'));
    }

    public static function facilitator(Retro $retro, Participant $participant): void
    {
        if ($retro->isFacilitator($participant)) {
            return;
        }

        throw new AuthorizationException(__('Only the facilitator can do this.'));
    }

    public static function author(Card $card, Participant $participant): void
    {
        if ($card->participant_id === $participant->id) {
            return;
        }

        throw new AuthorizationException(__('You can only change your own cards.'));
    }
}
```

`app/Http/Middleware/ResolveRetroParticipant.php`:

```php
<?php

namespace App\Http\Middleware;

use App\Actions\Retros\ResolveParticipant;
use App\Models\Retro;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResolveRetroParticipant
{
    public function __construct(private ResolveParticipant $resolveParticipant) {}

    public function handle(Request $request, Closure $next): Response
    {
        $retro = $request->route('retro');

        abort_unless($retro instanceof Retro, 404);

        $participant = $this->resolveParticipant->handle($request, $retro);

        if ($participant === null && $request->user() === null && ! $request->expectsJson()) {
            return redirect()->guest(route('login'));
        }

        abort_if($participant === null, 403);

        $request->attributes->set('participant', $participant);

        return $next($request);
    }
}
```

`app/Http/Controllers/Retros/RetrosController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\BuildBoardSnapshot;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RetrosController extends Controller
{
    public function show(Request $request, Retro $retro, BuildBoardSnapshot $buildBoardSnapshot): Response
    {
        return Inertia::render('retros/show', [
            'snapshot' => $buildBoardSnapshot->handle($retro, Participant::current($request)),
        ]);
    }
}
```

`app/Http/Controllers/Retros/RetroSnapshotsController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\BuildBoardSnapshot;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RetroSnapshotsController extends Controller
{
    public function show(Request $request, Retro $retro, BuildBoardSnapshot $buildBoardSnapshot): JsonResponse
    {
        return response()->json($buildBoardSnapshot->handle($retro, Participant::current($request)));
    }
}
```

`routes/web.php` — add (outside auth groups; import controllers and middleware):

```php
Route::prefix('retros/{retro}')
    ->whereUuid('retro')
    ->middleware(ResolveRetroParticipant::class)
    ->scopeBindings()
    ->group(function () {
        Route::get('/', [RetrosController::class, 'show'])->name('retros.show');
        Route::get('snapshot', [RetroSnapshotsController::class, 'show'])->name('retros.snapshot.show');
    });
```

If `->whereUuid('retro')` is not available on the route registrar for prefixes, add `->whereUuid('retro')` to each route instead (Task 8+ routes too).

`tests/Pest.php` — add helper:

```php
/**
 * @return array<string, string>
 */
function retroGuestCookie(Participant $participant, string $secret = 'secret'): array
{
    return [App\Actions\Retros\GuestCookie::name($participant->retro_id) => "{$participant->id}|{$secret}"];
}
```

`resources/js/pages/retros/show.tsx` (placeholder until Plan 4 builds the board):

```tsx
import { Head } from '@inertiajs/react';
import Heading from '@/components/heading';
import { useTrans } from '@/hooks/use-trans';

type Props = {
    snapshot: {
        retro: { id: string; title: string; phase: string };
    };
};

export default function ShowRetro({ snapshot }: Props) {
    const { t } = useTrans();

    return (
        <>
            <Head title={snapshot.retro.title} />
            <div className="mx-auto max-w-3xl p-6">
                <Heading title={snapshot.retro.title} description={t('The board is being built.')} />
            </div>
        </>
    );
}
```

`resources/js/app.tsx` — the app layout needs a logged-in user, guests don't have one: add `case name === 'retros/show': return null;` before the default case.

Add keys `This action is not available in the current phase.`, `Only the facilitator can do this.`, `You can only change your own cards.`, `The board is being built.` to the four lang files.

- [ ] **Step 4: Run tests, commit**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros` → PASS. Then the full suite.

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse
vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check
git add -A && git commit -m "feat: resolve retro participants and serve the board snapshot

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FcMxGGHCZcDTndQCc57VPC"
```

---

### Task 5: Create retros from a team

**Files:**
- Create: `app/Actions/Retros/CreateRetro.php`, `app/Http/Controllers/TeamRetrosController.php`
- Modify: `app/Policies/TeamPolicy.php`, `app/Http/Controllers/TeamsController.php`, `routes/web.php`, `resources/js/pages/teams/show.tsx`, `resources/js/types/workspaces.ts`, `lang/*.json`
- Test: `tests/Feature/Retros/CreateRetroTest.php`

**Interfaces:**
- Consumes: `RetroTemplate` (Task 1), route `retros.show` (Task 4), `TeamPolicy` (Plan 1).
- Produces:
  - `CreateRetro::handle(Team $team, User $creator, string $title, RetroTemplate $template): Retro` — columns copied from the template with titles translated into the current locale, creator participant, facilitator set, `guest_token` = 40 random chars.
  - `TeamPolicy::createRetro(User, Team): bool` (workspace manager or team member)
  - Route `teams.retros.store` (POST `/w/{workspace}/teams/{team}/retros`) inside the workspace group → redirects to `retros.show`.
  - `teams/show` props add `retros: {id, title, phase, phaseLabel, createdAt}[]`, `templates: {value, label}[]`, `canCreateRetro: bool`.

- [ ] **Step 1: Write the failing test**

`vendor/bin/sail artisan make:test --pest Retros/CreateRetroTest`:

```php
<?php

use App\Actions\Retros\CreateRetro;
use App\Enums\RetroPhase;
use App\Enums\RetroTemplate;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Inertia\Testing\AssertableInertia as Assert;

function teamWithMember(WorkspaceRole $role = WorkspaceRole::Member, bool $inTeam = true): array
{
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, $role)->create();
    $team = Team::factory()->for($workspace)->create();

    if ($inTeam) {
        $team->members()->attach($user);
    }

    return [$user, $workspace, $team];
}

it('creates a retro with translated template columns and the creator as facilitator', function () {
    [$user, , $team] = teamWithMember();
    app()->setLocale('fr');

    $retro = app(CreateRetro::class)->handle($team, $user, 'Sprint 42', RetroTemplate::StartStopContinue);

    expect($retro->phase)->toBe(RetroPhase::Writing)
        ->and($retro->columns->pluck('title')->all())->toBe([__('Start'), __('Stop'), __('Continue')])
        ->and($retro->columns->pluck('position')->all())->toBe([0, 1, 2])
        ->and($retro->facilitator->user_id)->toBe($user->id)
        ->and($retro->guest_access_enabled)->toBeFalse()
        ->and(strlen($retro->guest_token))->toBe(40);
});

it('creates a custom retro without columns', function () {
    [$user, , $team] = teamWithMember();

    expect(app(CreateRetro::class)->handle($team, $user, 'Free form', RetroTemplate::Custom)->columns)->toHaveCount(0);
});

it('lets team members create retros from the team page', function () {
    [$user, $workspace, $team] = teamWithMember();

    $response = $this->actingAs($user)->post(route('teams.retros.store', [$workspace, $team]), [
        'title' => 'Sprint 42',
        'template' => 'mad_sad_glad',
    ]);

    $retro = $team->retros()->sole();
    $response->assertRedirect(route('retros.show', $retro));
});

it('lets workspace managers create retros in any team', function () {
    [$admin, $workspace, $team] = teamWithMember(WorkspaceRole::Admin, inTeam: false);

    $this->actingAs($admin)
        ->post(route('teams.retros.store', [$workspace, $team]), ['title' => 'X', 'template' => 'four_ls'])
        ->assertRedirect();
});

it('forbids members outside the team', function () {
    [$member, $workspace, $team] = teamWithMember(inTeam: false);

    $this->actingAs($member)
        ->post(route('teams.retros.store', [$workspace, $team]), ['title' => 'X', 'template' => 'four_ls'])
        ->assertForbidden();
});

it('validates the title and template', function (array $payload, string $field) {
    [$user, $workspace, $team] = teamWithMember();

    $this->actingAs($user)
        ->post(route('teams.retros.store', [$workspace, $team]), $payload)
        ->assertSessionHasErrors($field);
})->with([
    [['title' => '', 'template' => 'four_ls'], 'title'],
    [['title' => str_repeat('a', 121), 'template' => 'four_ls'], 'title'],
    [['title' => 'X', 'template' => 'nope'], 'template'],
]);

it('lists the team retros newest first', function () {
    [$user, $workspace, $team] = teamWithMember();
    $older = app(CreateRetro::class)->handle($team, $user, 'Older', RetroTemplate::FourLs);
    $this->travel(1)->minutes();
    $newer = app(CreateRetro::class)->handle($team, $user, 'Newer', RetroTemplate::FourLs);

    $this->actingAs($user)
        ->get(route('teams.show', [$workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('retros.0.id', $newer->id)
            ->where('retros.1.id', $older->id)
            ->where('retros.0.phase', 'writing')
            ->where('canCreateRetro', true)
            ->has('templates', 5));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/CreateRetroTest.php`
Expected: FAIL.

- [ ] **Step 3: Implement**

`app/Actions/Retros/CreateRetro.php`:

```php
<?php

namespace App\Actions\Retros;

use App\Enums\RetroPhase;
use App\Enums\RetroTemplate;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreateRetro
{
    public function handle(Team $team, User $creator, string $title, RetroTemplate $template): Retro
    {
        return DB::transaction(function () use ($team, $creator, $title, $template): Retro {
            $retro = $team->retros()->create([
                'title' => $title,
                'template' => $template,
                'phase' => RetroPhase::Writing,
                'guest_token' => Str::random(40),
            ]);

            foreach ($template->columns() as $position => $column) {
                $retro->columns()->create([
                    'title' => __($column['title']),
                    'color' => $column['color'],
                    'position' => $position,
                ]);
            }

            $facilitator = $retro->participants()->create(['user_id' => $creator->id]);

            $retro->update(['facilitator_participant_id' => $facilitator->id]);

            return $retro->fresh(['columns', 'facilitator']);
        });
    }
}
```

`TeamPolicy` — add:

```php
public function createRetro(User $user, Team $team): bool
{
    return $this->view($user, $team);
}
```

`app/Http/Controllers/TeamRetrosController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Retros\CreateRetro;
use App\Enums\RetroTemplate;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class TeamRetrosController extends Controller
{
    public function store(Request $request, Workspace $workspace, Team $team, CreateRetro $createRetro): RedirectResponse
    {
        Gate::authorize('createRetro', $team);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'template' => ['required', Rule::enum(RetroTemplate::class)],
        ]);

        $retro = $createRetro->handle($team, $request->user(), $validated['title'], RetroTemplate::from($validated['template']));

        return to_route('retros.show', $retro);
    }
}
```

`routes/web.php` — inside the `w/{workspace}` group: `Route::post('teams/{team}/retros', [TeamRetrosController::class, 'store'])->name('teams.retros.store');`

`TeamsController::show` — add props:

```php
'retros' => $team->retros()->latest()->get()->map(fn (Retro $retro) => [
    'id' => $retro->id,
    'title' => $retro->title,
    'phase' => $retro->phase->value,
    'phaseLabel' => $retro->phase->label(),
    'createdAt' => $retro->created_at?->toIso8601String(),
]),
'templates' => RetroTemplate::options(),
'canCreateRetro' => $request->user()->can('createRetro', $team),
```

`resources/js/types/workspaces.ts` — add:

```ts
export type RetroSummary = {
    id: string;
    title: string;
    phase: string;
    phaseLabel: string;
    createdAt: string;
};

export type TemplateOption = {
    value: string;
    label: string;
};
```

`resources/js/pages/teams/show.tsx` — accept `retros`, `templates`, `canCreateRetro`; change the heading description to `t('Retrospectives of this team')`; add a section above "Members":

```tsx
<section className="space-y-3">
    <Heading variant="small" title={t('Retrospectives')} />

    {canCreateRetro && (
        <Form {...TeamRetrosController.store.form(params)} className="flex flex-wrap items-start gap-2">
            {({ processing, errors }) => (
                <>
                    <div className="min-w-64 flex-1">
                        <Input name="title" required maxLength={120} placeholder={t('Retrospective title')} aria-label={t('Retrospective title')} />
                        <InputError message={errors.title} />
                    </div>
                    <Select name="template" defaultValue={templates[0]?.value}>
                        <SelectTrigger className="w-64" aria-label={t('Template')}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {templates.map((template) => (
                                <SelectItem key={template.value} value={template.value}>{template.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button disabled={processing}>{t('Start a retrospective')}</Button>
                </>
            )}
        </Form>
    )}

    {retros.length === 0 && <p className="text-muted-foreground">{t('No retrospectives yet.')}</p>}

    <ul className="divide-y rounded-md border">
        {retros.map((retro) => (
            <li key={retro.id}>
                <Link href={RetrosController.show(retro.id)} className="flex items-center justify-between p-3 hover:bg-muted">
                    <span className="font-medium">{retro.title}</span>
                    <Badge variant="secondary">{retro.phaseLabel}</Badge>
                </Link>
            </li>
        ))}
    </ul>
</section>
```

(imports: `Link` from `@inertiajs/react`, `TeamRetrosController` from `@/actions/App/Http/Controllers/TeamRetrosController`, `RetrosController` from `@/actions/App/Http/Controllers/Retros/RetrosController`, `Badge`, `Select*`, types `RetroSummary`, `TemplateOption`.) Template and phase labels come already translated from the server.

Add keys `Retrospectives of this team`, `Retrospectives`, `Retrospective title`, `Template`, `Start a retrospective`, `No retrospectives yet.` to the four lang files; remove nothing (the old "Retrospectives will appear here." key may stay).

- [ ] **Step 4: Run tests, commit**

Run: `vendor/bin/sail artisan test --compact` → all PASS.

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse
vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check
git add -A && git commit -m "feat: create retrospectives from the team page

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FcMxGGHCZcDTndQCc57VPC"
```

---

### Task 6: Guest join link

**Files:**
- Create: `app/Http/Controllers/RetroJoinsController.php`, `resources/js/pages/retros/join.tsx`
- Modify: `routes/web.php`, `app/Actions/Retros/BuildBoardSnapshot.php`, `resources/js/app.tsx`, `lang/*.json`
- Test: `tests/Feature/Retros/GuestJoinTest.php`

**Interfaces:**
- Consumes: `ResolveParticipant`, `GuestCookie` (Task 4).
- Produces: routes `retros.join.show` (GET `/join/{guestToken}`) and `retros.join.store` (POST `/join/{guestToken}`); snapshot `retro.guestUrl` (`route('retros.join.show', $retro->guest_token)` for the facilitator when guest access is enabled, otherwise `null`).

Rules (spec §3 Guests): unknown token or guest access disabled → `retros/join` page with `isInvalid: true`, status 404, no retro details. A viewer who already resolves to a participant (team member, or guest with a valid cookie) is redirected to the board. Otherwise the page asks for a display name (prefilled with the logged-in user's name); submitting creates a guest participant with a random secret and sets the cookie.

- [ ] **Step 1: Write the failing test**

`vendor/bin/sail artisan make:test --pest Retros/GuestJoinTest`:

```php
<?php

use App\Actions\Retros\BuildBoardSnapshot;
use App\Actions\Retros\GuestCookie;
use App\Enums\WorkspaceRole;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('shows the join form for an enabled guest link', function () {
    $retro = Retro::factory()->withGuestAccess()->create(['title' => 'Sprint 42']);

    $this->get(route('retros.join.show', $retro->guest_token))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('retros/join')
            ->where('isInvalid', false)
            ->where('retroTitle', 'Sprint 42')
            ->where('suggestedName', null));
});

it('joins as a guest and resumes with the cookie', function () {
    $retro = Retro::factory()->withGuestAccess()->create();

    $response = $this->post(route('retros.join.store', $retro->guest_token), ['name' => 'Visitor'])
        ->assertRedirect(route('retros.show', $retro))
        ->assertCookie(GuestCookie::name($retro->id));

    $guest = $retro->participants()->where('guest_name', 'Visitor')->sole();
    $cookieValue = $response->getCookie(GuestCookie::name($retro->id), decrypt: true)->getValue();

    expect(str_starts_with($cookieValue, $guest->id.'|'))->toBeTrue()
        ->and($guest->guest_secret_hash)->not->toContain(explode('|', $cookieValue)[1]);

    $this->withCookies([GuestCookie::name($retro->id) => $cookieValue])
        ->get(route('retros.join.show', $retro->guest_token))
        ->assertRedirect(route('retros.show', $retro));
});

it('requires a display name', function (string $name) {
    $retro = Retro::factory()->withGuestAccess()->create();

    $this->post(route('retros.join.store', $retro->guest_token), ['name' => $name])->assertSessionHasErrors('name');
})->with(['', str_repeat('a', 51)]);

it('refuses disabled or unknown links without revealing the retro', function (Closure $token) {
    $retro = Retro::factory()->create(['title' => 'Private']);

    $this->get(route('retros.join.show', $token($retro)))
        ->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page
            ->component('retros/join')
            ->where('isInvalid', true)
            ->missing('retroTitle'));

    $this->post(route('retros.join.store', $token($retro)), ['name' => 'X'])->assertNotFound();
})->with([
    'disabled' => fn () => fn (Retro $retro) => $retro->guest_token,
    'unknown' => fn () => fn () => 'unknown-token',
]);

it('invalidates old links when the token changes', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    $oldToken = $retro->guest_token;
    $retro->update(['guest_token' => 'a-brand-new-token']);

    $this->get(route('retros.join.show', $oldToken))->assertNotFound();
});

it('sends team members straight to the board as themselves', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    $user = User::factory()->create();
    $retro->team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
    $retro->team->members()->attach($user);

    $this->actingAs($user)
        ->get(route('retros.join.show', $retro->guest_token))
        ->assertRedirect(route('retros.show', $retro));

    expect($retro->participants()->where('user_id', $user->id)->exists())->toBeTrue();
});

it('lets a logged in outsider join as a guest without team access', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    $outsider = User::factory()->create(['name' => 'Olga']);

    $this->actingAs($outsider)
        ->get(route('retros.join.show', $retro->guest_token))
        ->assertInertia(fn (Assert $page) => $page->where('suggestedName', 'Olga'));

    $this->actingAs($outsider)->post(route('retros.join.store', $retro->guest_token), ['name' => 'Olga']);

    expect($retro->participants()->where('guest_name', 'Olga')->whereNull('user_id')->exists())->toBeTrue()
        ->and($outsider->can('view', $retro->team))->toBeFalse();
});

it('shares the guest link with the facilitator only', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    [, $facilitator] = retroFacilitator($retro);
    [, $member] = retroMember($retro);

    $snapshot = app(BuildBoardSnapshot::class);

    expect($snapshot->handle($retro->fresh(), $facilitator)['retro']['guestUrl'])->toBe(route('retros.join.show', $retro->guest_token))
        ->and($snapshot->handle($retro->fresh(), $member)['retro']['guestUrl'])->toBeNull();

    $retro->update(['guest_access_enabled' => false]);

    expect($snapshot->handle($retro->fresh(), $facilitator)['retro']['guestUrl'])->toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/GuestJoinTest.php`
Expected: FAIL.

- [ ] **Step 3: Implement**

`app/Http/Controllers/RetroJoinsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Retros\GuestCookie;
use App\Actions\Retros\ResolveParticipant;
use App\Models\Retro;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class RetroJoinsController extends Controller
{
    public function show(Request $request, string $guestToken, ResolveParticipant $resolveParticipant): Response
    {
        $retro = $this->findRetro($guestToken);

        if ($retro === null) {
            return $this->invalidLink($request);
        }

        if ($resolveParticipant->handle($request, $retro) !== null) {
            return to_route('retros.show', $retro);
        }

        return Inertia::render('retros/join', [
            'isInvalid' => false,
            'guestToken' => $guestToken,
            'retroTitle' => $retro->title,
            'suggestedName' => $request->user()?->name,
        ])->toResponse($request);
    }

    public function store(Request $request, string $guestToken, ResolveParticipant $resolveParticipant): Response
    {
        $retro = $this->findRetro($guestToken);

        if ($retro === null) {
            return $this->invalidLink($request);
        }

        if ($resolveParticipant->handle($request, $retro) !== null) {
            return to_route('retros.show', $retro);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50'],
        ]);

        $secret = Str::random(40);

        $participant = $retro->participants()->create([
            'guest_name' => $validated['name'],
            'guest_secret_hash' => hash('sha256', $secret),
        ]);

        return to_route('retros.show', $retro)->withCookie(GuestCookie::make($participant, $secret));
    }

    private function findRetro(string $guestToken): ?Retro
    {
        return Retro::query()
            ->where('guest_token', $guestToken)
            ->where('guest_access_enabled', true)
            ->first();
    }

    private function invalidLink(Request $request): Response
    {
        return Inertia::render('retros/join', ['isInvalid' => true])
            ->toResponse($request)
            ->setStatusCode(404);
    }
}
```

`routes/web.php` — public routes: `Route::get('join/{guestToken}', [RetroJoinsController::class, 'show'])->name('retros.join.show');` and `Route::post('join/{guestToken}', [RetroJoinsController::class, 'store'])->name('retros.join.store')->middleware('throttle:10,1');`

`BuildBoardSnapshot` — add to the `retro` array:

```php
'guestUrl' => $retro->guest_access_enabled && $retro->isFacilitator($viewer)
    ? route('retros.join.show', $retro->guest_token)
    : null,
```

`resources/js/pages/retros/join.tsx`:

```tsx
import { Form, Head } from '@inertiajs/react';
import RetroJoinsController from '@/actions/App/Http/Controllers/RetroJoinsController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';

type Props =
    | { isInvalid: true }
    | { isInvalid: false; guestToken: string; retroTitle: string; suggestedName: string | null };

export default function JoinRetro(props: Props) {
    const { t } = useTrans();

    if (props.isInvalid) {
        return (
            <>
                <Head title={t('Join a retrospective')} />
                <Heading title={t('Join a retrospective')} description={t('This guest link is no longer valid.')} />
            </>
        );
    }

    return (
        <>
            <Head title={props.retroTitle} />
            <div className="space-y-6">
                <Heading title={props.retroTitle} description={t('Choose the name other participants will see.')} />
                <Form {...RetroJoinsController.store.form(props.guestToken)} className="space-y-4">
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="name">{t('Display name')}</Label>
                                <Input id="name" name="name" required maxLength={50} autoFocus defaultValue={props.suggestedName ?? ''} />
                                <InputError message={errors.name} />
                            </div>
                            <Button className="w-full" disabled={processing}>{t('Join')}</Button>
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}
```

`resources/js/app.tsx` — add `case name === 'retros/join': return AuthLayout;` before the `retros/show` case.

Add keys `Join a retrospective`, `This guest link is no longer valid.`, `Choose the name other participants will see.`, `Display name`, `Join` to the four lang files.

- [ ] **Step 4: Run tests, commit**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros` → PASS.

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse
vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check
git add -A && git commit -m "feat: let guests join a retro through its link

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FcMxGGHCZcDTndQCc57VPC"
```

---

### Task 7: Broadcasting infrastructure and channel authorization

**Files:**
- Install: `laravel/reverb` (with `-W`), broadcasting config via the framework installer
- Create: `app/Events/Retros/RetroBroadcastEvent.php`, `app/Http/Controllers/BroadcastAuthorizationsController.php`
- Modify: `routes/web.php`, `bootstrap/app.php` (if the installer registers channel routes), `.env.example`
- Test: `tests/Feature/Retros/BroadcastAuthorizationTest.php`, `tests/Feature/Retros/RetroBroadcastEventTest.php`

**Interfaces:**
- Consumes: `ResolveParticipant` (Task 4), `Participant::avatarUrl()` (Task 2).
- Produces:
  - `abstract class RetroBroadcastEvent implements ShouldBroadcastNow, ShouldDispatchAfterCommit` (uses `Dispatchable`, `InteractsWithSockets`; `public string $retroId`; `broadcastOn(): PresenceChannel` = `retro.{retroId}`; subclasses implement `broadcastAs()` and `broadcastWith()`)
  - Route `broadcasting.auth` (POST `/broadcasting/auth`) handled by `BroadcastAuthorizationsController@store`: accepts only `presence-retro.{uuid}` channels, resolves the participant (member or guest, same rules as the board), returns the Pusher presence signature with `user_id` = participant id and `user_info` = `{name, avatarUrl, isGuest}`; 403 otherwise.

- [ ] **Step 1: Install**

```bash
vendor/bin/sail composer require laravel/reverb -W
vendor/bin/sail artisan install:broadcasting --reverb --without-node --no-interaction
```

After the installer, the final state must be:
- `config/broadcasting.php` exists with a `reverb` connection; `config/reverb.php` exists.
- `.env` has `BROADCAST_CONNECTION=reverb` and `REVERB_APP_ID`, `REVERB_APP_KEY`, `REVERB_APP_SECRET`, `REVERB_HOST`, `REVERB_PORT`, `REVERB_SCHEME` (+ the `VITE_REVERB_*` mirrors); `.env.example` lists the same keys with empty or default values and `BROADCAST_CONNECTION=reverb`.
- **No framework broadcasting routes:** if the installer added `channels: __DIR__.'/../routes/channels.php'` to `bootstrap/app.php` (or a `->withBroadcasting(...)` call), remove it and delete `routes/channels.php` — authorization is done by our own controller.
- `phpunit.xml` keeps `BROADCAST_CONNECTION=null`.
- `guzzlehttp/guzzle` is now 7.x (expected; `composer why-not guzzlehttp/guzzle 8` explains it). Run the full suite to confirm nothing depended on Guzzle 8.

- [ ] **Step 2: Write the failing tests**

`vendor/bin/sail artisan make:test --pest Retros/BroadcastAuthorizationTest`:

```php
<?php

use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;

beforeEach(function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => 'test-app',
    ]);
});

function authorizeChannel(Retro $retro): array
{
    return [
        'socket_id' => '1234.5678',
        'channel_name' => "presence-retro.{$retro->id}",
    ];
}

it('signs presence data for a team member', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);

    $response = $this->actingAs($user)->postJson(route('broadcasting.auth'), authorizeChannel($retro))->assertOk();

    $channelData = json_decode($response->json('channel_data'), true);

    expect($response->json('auth'))->toStartWith('test-key:')
        ->and($channelData['user_id'])->toBe($participant->id)
        ->and($channelData['user_info'])->toBe([
            'name' => $user->name,
            'avatarUrl' => $participant->avatarUrl(),
            'isGuest' => false,
        ]);
});

it('signs presence data for a guest with a valid cookie', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $response = $this->withCookies(retroGuestCookie($guest))
        ->postJson(route('broadcasting.auth'), authorizeChannel($retro))
        ->assertOk();

    expect(json_decode($response->json('channel_data'), true)['user_id'])->toBe($guest->id);
});

it('refuses guests once guest access is disabled', function () {
    $retro = Retro::factory()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))
        ->postJson(route('broadcasting.auth'), authorizeChannel($retro))
        ->assertForbidden();
});

it('refuses outsiders', function () {
    $retro = Retro::factory()->create();

    $this->actingAs(User::factory()->create())
        ->postJson(route('broadcasting.auth'), authorizeChannel($retro))
        ->assertForbidden();
});

it('refuses other channels and malformed names', function (string $channel) {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), ['socket_id' => '1234.5678', 'channel_name' => $channel])
        ->assertForbidden();
})->with([
    'private channel' => 'private-App.Models.User.1',
    'not a uuid' => 'presence-retro.nope',
    'unknown retro' => 'presence-retro.'.fake()->uuid(),
]);

it('validates the socket id', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), ['socket_id' => 'evil', 'channel_name' => "presence-retro.{$retro->id}"])
        ->assertUnprocessable();
});
```

`vendor/bin/sail artisan make:test --pest Retros/RetroBroadcastEventTest`:

```php
<?php

use App\Events\Retros\RetroBroadcastEvent;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;

it('broadcasts retro events on the retro presence channel after commit', function () {
    $event = new class('retro-id') extends RetroBroadcastEvent
    {
        public function broadcastAs(): string
        {
            return 'test.event';
        }

        public function broadcastWith(): array
        {
            return [];
        }
    };

    expect($event)->toBeInstanceOf(ShouldBroadcastNow::class)
        ->and($event)->toBeInstanceOf(ShouldDispatchAfterCommit::class)
        ->and($event->broadcastOn())->toBeInstanceOf(PresenceChannel::class)
        ->and($event->broadcastOn()->name)->toBe('presence-retro.retro-id');
});
```

- [ ] **Step 3: Run to verify failure**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/BroadcastAuthorizationTest.php tests/Feature/Retros/RetroBroadcastEventTest.php`
Expected: FAIL.

- [ ] **Step 4: Implement**

`app/Events/Retros/RetroBroadcastEvent.php`:

```php
<?php

namespace App\Events\Retros;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

abstract class RetroBroadcastEvent implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable;
    use InteractsWithSockets;

    public function __construct(public string $retroId) {}

    public function broadcastOn(): PresenceChannel
    {
        return new PresenceChannel("retro.{$this->retroId}");
    }

    abstract public function broadcastAs(): string;

    /**
     * @return array<string, mixed>
     */
    abstract public function broadcastWith(): array;
}
```

`app/Http/Controllers/BroadcastAuthorizationsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Retros\ResolveParticipant;
use App\Models\Retro;
use Illuminate\Broadcasting\Broadcasters\PusherBroadcaster;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Str;

class BroadcastAuthorizationsController extends Controller
{
    public function store(Request $request, ResolveParticipant $resolveParticipant): JsonResponse
    {
        $validated = $request->validate([
            'socket_id' => ['required', 'string', 'regex:/^\d+\.\d+$/'],
            'channel_name' => ['required', 'string'],
        ]);

        $retroId = Str::after($validated['channel_name'], 'presence-retro.');

        abort_unless(str_starts_with($validated['channel_name'], 'presence-retro.'), 403);
        abort_unless(Str::isUuid($retroId), 403);

        $retro = Retro::query()->find($retroId);

        abort_if($retro === null, 403);

        $participant = $resolveParticipant->handle($request, $retro);

        abort_if($participant === null, 403);

        $broadcaster = Broadcast::connection();

        abort_unless($broadcaster instanceof PusherBroadcaster, 503);

        $signature = $broadcaster->getPusher()->authorizePresenceChannel(
            $validated['channel_name'],
            $validated['socket_id'],
            $participant->id,
            [
                'name' => $participant->displayName(),
                'avatarUrl' => $participant->avatarUrl(),
                'isGuest' => $participant->isGuest(),
            ],
        );

        return response()->json(json_decode($signature, true));
    }
}
```

`routes/web.php` — add (public, web group so the session and guest cookies are read): `Route::post('broadcasting/auth', [BroadcastAuthorizationsController::class, 'store'])->name('broadcasting.auth');`

Channel authorization must not create a participant for a member who never opened the board? It does (same resolver) — acceptable: opening the socket implies opening the board.

- [ ] **Step 5: Run tests, commit**

Run: `vendor/bin/sail artisan test --compact` → all PASS.

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse
git add -A && git commit -m "feat: add reverb broadcasting and retro channel authorization

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FcMxGGHCZcDTndQCc57VPC"
```

---

### Task 8: Cards — write, edit, delete, move

**Files:**
- Create: `app/Actions/Retros/PlaceCard.php`, `app/Http/Controllers/Retros/CardsController.php`, `app/Http/Controllers/Retros/CardPositionsController.php`, `app/Events/Retros/{CardCreated,CardUpdated,CardDeleted,CardsMoved}.php`
- Modify: `routes/web.php`, `lang/*.json`
- Test: `tests/Feature/Retros/CardsTest.php`

**Interfaces:**
- Consumes: `RetroGuard`, `PresentCard`, `Participant::current`, `RetroBroadcastEvent`.
- Produces:
  - Routes (inside the `retros/{retro}` group): `retros.cards.store` POST `cards` `{column_id, content}` → 201 `{card}`; `retros.cards.update` PATCH `cards/{card}` `{content}` → `{card}`; `retros.cards.destroy` DELETE `cards/{card}` → 204; `retros.cards.position.update` PUT `cards/{card}/position` `{column_id, index}` → `{cards}` (every card whose column or position changed, presented for the sender).
  - `PlaceCard::handle(Card $card, Column $column, int $index): Collection<int, Card>` — detaches the card from any group, puts it at `index` among the column's top-level cards, resequences positions `0..n` in the source and target columns, moves its children to the target column, returns changed cards.
  - Events: `CardCreated{card}` (`card.created`), `CardUpdated{card}` (`card.updated`), `CardDeleted{cardId, ungroupedCardIds}` (`card.deleted`), `CardsMoved{cards}` (`cards.moved`) — payload cards presented with viewer `null`.

Rules: create — Writing only, column must belong to the retro, content 1–1000 chars, appended at the end of the column. Edit/delete — author only, Writing or Grouping. Deleting a lead card ungroups its children (FK `nullOnDelete`). Move — Writing: author only; Grouping: anyone; other phases 403. `index` ≥ 0 (larger than the column size = end).

- [ ] **Step 1: Write the failing test**

`vendor/bin/sail artisan make:test --pest Retros/CardsTest`:

```php
<?php

use App\Enums\RetroPhase;
use App\Events\Retros\CardCreated;
use App\Events\Retros\CardDeleted;
use App\Events\Retros\CardsMoved;
use App\Events\Retros\CardUpdated;
use App\Models\Card;
use App\Models\Column;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('writes a card at the end of a column and hides it from others', function () {
    $retro = Retro::factory()->create();
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'position' => 0]);
    [$user, $participant] = retroMember($retro);

    $response = $this->actingAs($user)
        ->withHeader('X-Socket-ID', '111.222')
        ->postJson(route('retros.cards.store', $retro), ['column_id' => $column->id, 'content' => 'Deploys are slow'])
        ->assertCreated()
        ->assertJsonPath('card.content', 'Deploys are slow')
        ->assertJsonPath('card.isMine', true)
        ->assertJsonPath('card.position', 1);

    Event::assertDispatched(CardCreated::class, fn (CardCreated $event) => $event->retroId === $retro->id
        && $event->card['id'] === $response->json('card.id')
        && $event->card['content'] === null
        && $event->card['author'] === null
        && $event->socket === '111.222');

    expect(Card::find($response->json('card.id'))->participant_id)->toBe($participant->id);
});

it('only accepts new cards while writing', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('retros.cards.store', $retro), ['column_id' => $column->id, 'content' => 'Late'])
        ->assertForbidden()
        ->assertJsonPath('message', 'This action is not available in the current phase.');
});

it('rejects columns of another retro and invalid content', function (Closure $payload) {
    $retro = Retro::factory()->create();
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    $foreignColumn = Column::factory()->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('retros.cards.store', $retro), $payload($column, $foreignColumn))
        ->assertUnprocessable();
})->with([
    'foreign column' => fn () => fn ($column, $foreign) => ['column_id' => $foreign->id, 'content' => 'x'],
    'empty' => fn () => fn ($column) => ['column_id' => $column->id, 'content' => ''],
    'too long' => fn () => fn ($column) => ['column_id' => $column->id, 'content' => str_repeat('a', 1001)],
]);

it('lets authors edit and delete their cards in writing and grouping', function (RetroPhase $phase) {
    $retro = Retro::factory()->inPhase($phase)->create();
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);

    $this->actingAs($user)
        ->patchJson(route('retros.cards.update', [$retro, $card]), ['content' => 'Edited'])
        ->assertOk()
        ->assertJsonPath('card.content', 'Edited');

    $this->actingAs($user)->deleteJson(route('retros.cards.destroy', [$retro, $card]))->assertNoContent();

    Event::assertDispatched(CardUpdated::class);
    Event::assertDispatched(CardDeleted::class, fn (CardDeleted $event) => $event->cardId === $card->id);
    expect(Card::find($card->id))->toBeNull();
})->with([RetroPhase::Writing, RetroPhase::Grouping]);

it('refuses edits by other participants and in later phases', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)
        ->patchJson(route('retros.cards.update', [$retro, $card]), ['content' => 'Hijack'])
        ->assertForbidden();

    $retro->update(['phase' => RetroPhase::Voting]);

    $this->actingAs($card->participant->user)
        ->deleteJson(route('retros.cards.destroy', [$retro, $card]))
        ->assertForbidden();
});

it('returns 404 for cards of another retro', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    $foreignCard = Card::factory()->create();

    $this->actingAs($user)
        ->patchJson(route('retros.cards.update', [$retro, $foreignCard]), ['content' => 'x'])
        ->assertNotFound();
});

it('ungroups children when their lead card is deleted', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [$user, $participant] = retroMember($retro);
    $lead = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);
    $child = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $lead->column_id, 'parent_card_id' => $lead->id]);

    $this->actingAs($user)->deleteJson(route('retros.cards.destroy', [$retro, $lead]))->assertNoContent();

    expect($child->fresh()->parent_card_id)->toBeNull();
    Event::assertDispatched(CardDeleted::class, fn (CardDeleted $event) => $event->ungroupedCardIds === [$child->id]);
});

it('moves own cards between columns while writing and resequences positions', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);
    $from = Column::factory()->create(['retro_id' => $retro->id, 'position' => 0]);
    $to = Column::factory()->create(['retro_id' => $retro->id, 'position' => 1]);
    $moving = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $from->id, 'participant_id' => $participant->id, 'position' => 0]);
    $staying = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $from->id, 'position' => 1]);
    $first = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $to->id, 'position' => 0]);

    $this->actingAs($user)
        ->putJson(route('retros.cards.position.update', [$retro, $moving]), ['column_id' => $to->id, 'index' => 0])
        ->assertOk();

    expect($moving->fresh()->only(['column_id', 'position']))->toBe(['column_id' => $to->id, 'position' => 0])
        ->and($first->fresh()->position)->toBe(1)
        ->and($staying->fresh()->position)->toBe(0);

    Event::assertDispatched(CardsMoved::class, fn (CardsMoved $event) => collect($event->cards)->every(fn (array $card) => $card['content'] === null || $card['id'] !== $moving->id));
});

it('refuses moving others cards while writing but allows it while grouping', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)
        ->putJson(route('retros.cards.position.update', [$retro, $card]), ['column_id' => $card->column_id, 'index' => 0])
        ->assertForbidden();

    $retro->update(['phase' => RetroPhase::Grouping]);

    $this->actingAs($user)
        ->putJson(route('retros.cards.position.update', [$retro, $card]), ['column_id' => $card->column_id, 'index' => 5])
        ->assertOk();
});

it('ungroups a child card that is moved and carries a lead card children along', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [$user] = retroMember($retro);
    $target = Column::factory()->create(['retro_id' => $retro->id]);
    $lead = Card::factory()->create(['retro_id' => $retro->id]);
    $child = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $lead->column_id, 'parent_card_id' => $lead->id]);

    $this->actingAs($user)->putJson(route('retros.cards.position.update', [$retro, $lead]), ['column_id' => $target->id, 'index' => 0]);

    expect($child->fresh()->column_id)->toBe($target->id)
        ->and($child->fresh()->parent_card_id)->toBe($lead->id);

    $this->actingAs($user)->putJson(route('retros.cards.position.update', [$retro, $child]), ['column_id' => $target->id, 'index' => 0]);

    expect($child->fresh()->parent_card_id)->toBeNull()
        ->and($child->fresh()->position)->toBe(0)
        ->and($lead->fresh()->position)->toBe(1);
});

it('keeps content hidden from others in grouping broadcasts only when anonymous authors apply', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->anonymous()->create();
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);

    $this->actingAs($user)->patchJson(route('retros.cards.update', [$retro, $card]), ['content' => 'Visible text']);

    Event::assertDispatched(CardUpdated::class, fn (CardUpdated $event) => $event->card['content'] === 'Visible text' && $event->card['author'] === null);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/CardsTest.php`
Expected: FAIL.

- [ ] **Step 3: Events**

Each event lives in `app/Events/Retros/` and follows this shape (shown for `CardCreated`):

```php
<?php

namespace App\Events\Retros;

class CardCreated extends RetroBroadcastEvent
{
    /**
     * @param  array<string, mixed>  $card
     */
    public function __construct(string $retroId, public array $card)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'card.created';
    }

    public function broadcastWith(): array
    {
        return ['card' => $this->card];
    }
}
```

- `CardUpdated(string $retroId, public array $card)` → `card.updated`, `['card' => …]`
- `CardDeleted(string $retroId, public string $cardId, public array $ungroupedCardIds)` → `card.deleted`, `['cardId' => …, 'ungroupedCardIds' => …]`
- `CardsMoved(string $retroId, public array $cards)` → `cards.moved`, `['cards' => …]`

- [ ] **Step 4: PlaceCard**

`app/Actions/Retros/PlaceCard.php`:

```php
<?php

namespace App\Actions\Retros;

use App\Models\Card;
use App\Models\Column;
use Illuminate\Support\Collection;

class PlaceCard
{
    /**
     * @return Collection<int, Card>
     */
    public function handle(Card $card, Column $column, int $index): Collection
    {
        $sourceColumnId = $card->column_id;
        $changed = collect();

        if (! $card->isTopLevel()) {
            $card->parent_card_id = null;
        }

        $siblings = $column->cards()
            ->whereNull('parent_card_id')
            ->whereKeyNot($card->id)
            ->orderBy('position')
            ->get();

        $siblings->splice(min(max($index, 0), $siblings->count()), 0, [$card]);

        foreach ($siblings->values() as $position => $sibling) {
            $sibling->column_id = $column->id;
            $sibling->position = $position;

            if ($sibling->isDirty()) {
                $sibling->save();
                $changed->push($sibling);
            }
        }

        foreach ($card->children()->get() as $child) {
            if ($child->column_id !== $column->id) {
                $child->update(['column_id' => $column->id]);
                $changed->push($child);
            }
        }

        if ($sourceColumnId !== $column->id) {
            $changed = $changed->merge($this->resequence($sourceColumnId));
        }

        return $changed->unique('id')->values();
    }

    /**
     * @return Collection<int, Card>
     */
    private function resequence(string $columnId): Collection
    {
        $changed = collect();

        $cards = Card::query()
            ->where('column_id', $columnId)
            ->whereNull('parent_card_id')
            ->orderBy('position')
            ->get();

        foreach ($cards->values() as $position => $card) {
            if ($card->position !== $position) {
                $card->update(['position' => $position]);
                $changed->push($card);
            }
        }

        return $changed;
    }
}
```

- [ ] **Step 5: Controllers and routes**

`app/Http/Controllers/Retros/CardsController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\PresentCard;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\CardCreated;
use App\Events\Retros\CardDeleted;
use App\Events\Retros\CardUpdated;
use App\Http\Controllers\Controller;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CardsController extends Controller
{
    public function __construct(private PresentCard $presentCard) {}

    public function store(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Writing);

        $validated = $request->validate([
            'column_id' => ['required', 'uuid', Rule::exists('columns', 'id')->where('retro_id', $retro->id)],
            'content' => ['required', 'string', 'max:1000'],
        ]);

        $card = DB::transaction(function () use ($retro, $participant, $validated): Card {
            $position = $retro->cards()
                ->where('column_id', $validated['column_id'])
                ->whereNull('parent_card_id')
                ->max('position');

            $card = $retro->cards()->create([
                'column_id' => $validated['column_id'],
                'participant_id' => $participant->id,
                'content' => $validated['content'],
                'position' => $position === null ? 0 : $position + 1,
            ]);

            broadcast(new CardCreated($retro->id, $this->presentCard->handle($card, $retro, null)))->toOthers();

            return $card;
        });

        return response()->json(['card' => $this->presentCard->handle($card, $retro, $participant)], 201);
    }

    public function update(Request $request, Retro $retro, Card $card): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Writing, RetroPhase::Grouping);
        RetroGuard::author($card, $participant);

        $validated = $request->validate([
            'content' => ['required', 'string', 'max:1000'],
        ]);

        DB::transaction(function () use ($retro, $card, $validated): void {
            $card->update(['content' => $validated['content']]);

            broadcast(new CardUpdated($retro->id, $this->presentCard->handle($card, $retro, null)))->toOthers();
        });

        return response()->json(['card' => $this->presentCard->handle($card, $retro, $participant)]);
    }

    public function destroy(Request $request, Retro $retro, Card $card): Response
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Writing, RetroPhase::Grouping);
        RetroGuard::author($card, $participant);

        DB::transaction(function () use ($retro, $card): void {
            $ungroupedCardIds = $card->children()->pluck('id')->all();

            $card->delete();

            broadcast(new CardDeleted($retro->id, $card->id, $ungroupedCardIds))->toOthers();
        });

        return response()->noContent();
    }
}
```

`app/Http/Controllers/Retros/CardPositionsController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\PlaceCard;
use App\Actions\Retros\PresentCard;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\CardsMoved;
use App\Http\Controllers\Controller;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CardPositionsController extends Controller
{
    public function update(Request $request, Retro $retro, Card $card, PlaceCard $placeCard, PresentCard $presentCard): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Writing, RetroPhase::Grouping);

        if ($retro->phase === RetroPhase::Writing) {
            RetroGuard::author($card, $participant);
        }

        $validated = $request->validate([
            'column_id' => ['required', 'uuid', Rule::exists('columns', 'id')->where('retro_id', $retro->id)],
            'index' => ['required', 'integer', 'min:0'],
        ]);

        $changed = DB::transaction(function () use ($retro, $card, $validated, $placeCard, $presentCard) {
            $changed = $placeCard->handle($card, Column::findOrFail($validated['column_id']), (int) $validated['index']);

            broadcast(new CardsMoved($retro->id, $changed->map(fn (Card $moved) => $presentCard->handle($moved, $retro, null))->all()))->toOthers();

            return $changed;
        });

        return response()->json([
            'cards' => $changed->map(fn (Card $moved) => $presentCard->handle($moved, $retro, $participant))->all(),
        ]);
    }
}
```

`routes/web.php` — inside the `retros/{retro}` group:

```php
Route::post('cards', [CardsController::class, 'store'])->name('retros.cards.store');
Route::patch('cards/{card}', [CardsController::class, 'update'])->name('retros.cards.update');
Route::delete('cards/{card}', [CardsController::class, 'destroy'])->name('retros.cards.destroy');
Route::put('cards/{card}/position', [CardPositionsController::class, 'update'])->name('retros.cards.position.update');
```

`scopeBindings()` resolves `{card}` through `$retro->cards()` (foreign card → 404). Add `->whereUuid('card')` to each card route so malformed ids 404 instead of hitting Postgres.

`PresentCard` reads `$card->participant`; after `create()` the relation is lazy-loaded — fine.

- [ ] **Step 6: Run tests, commit**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros` → PASS.

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse
git add -A && git commit -m "feat: write, edit, delete and move retro cards

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FcMxGGHCZcDTndQCc57VPC"
```

---

### Task 9: Grouping

**Files:**
- Create: `app/Actions/Retros/GroupCard.php`, `app/Http/Controllers/Retros/CardGroupsController.php`, `app/Events/Retros/{CardGrouped,CardUngrouped}.php`
- Modify: `routes/web.php`, `lang/*.json`
- Test: `tests/Feature/Retros/GroupingTest.php`

**Interfaces:**
- Consumes: `PlaceCard` (Task 8), `PresentCard`, `RetroGuard`.
- Produces:
  - `GroupCard::group(Card $card, Card $lead): Collection<int, Card>` and `GroupCard::ungroup(Card $card): Collection<int, Card>` (return the changed cards)
  - Routes: `retros.cards.group.update` PUT `cards/{card}/group` `{parent_card_id}` → `{cards}`; `retros.cards.group.destroy` DELETE `cards/{card}/group` → `{cards}`
  - Events: `CardGrouped{cards}` (`card.grouped`), `CardUngrouped{cards}` (`card.ungrouped`)

Rules (spec §2 Grouping): Grouping phase only; anyone may group. The lead must be a top-level card of the same retro and not the card itself. Grouping a card that has children moves the children under the new lead too (one nesting level). Card and children take the lead's column. Votes on the card or its children are reassigned to the lead. Ungroup: card must have a parent; it becomes top-level at the end of its column.

- [ ] **Step 1: Write the failing test**

`vendor/bin/sail artisan make:test --pest Retros/GroupingTest`:

```php
<?php

use App\Enums\RetroPhase;
use App\Events\Retros\CardGrouped;
use App\Events\Retros\CardUngrouped;
use App\Models\Card;
use App\Models\Retro;
use App\Models\Vote;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function groupingRetro(): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [$user] = retroMember($retro);

    return [$retro, $user];
}

it('groups a card under a lead in the lead column', function () {
    [$retro, $user] = groupingRetro();
    $lead = Card::factory()->create(['retro_id' => $retro->id]);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)
        ->putJson(route('retros.cards.group.update', [$retro, $card]), ['parent_card_id' => $lead->id])
        ->assertOk();

    expect($card->fresh()->only(['parent_card_id', 'column_id']))->toBe(['parent_card_id' => $lead->id, 'column_id' => $lead->column_id]);
    Event::assertDispatched(CardGrouped::class);
});

it('moves an existing group under the new lead and reassigns votes', function () {
    [$retro, $user] = groupingRetro();
    $lead = Card::factory()->create(['retro_id' => $retro->id]);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    $child = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $card->column_id, 'parent_card_id' => $card->id]);
    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $this->actingAs($user)->putJson(route('retros.cards.group.update', [$retro, $card]), ['parent_card_id' => $lead->id])->assertOk();

    expect($child->fresh()->parent_card_id)->toBe($lead->id)
        ->and($child->fresh()->column_id)->toBe($lead->column_id)
        ->and($lead->votes()->count())->toBe(2)
        ->and($card->votes()->count())->toBe(0);
});

it('refuses invalid leads', function (Closure $lead) {
    [$retro, $user] = groupingRetro();
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)
        ->putJson(route('retros.cards.group.update', [$retro, $card]), ['parent_card_id' => $lead($retro, $card)])
        ->assertUnprocessable();
})->with([
    'itself' => fn () => fn ($retro, $card) => $card->id,
    'a child card' => fn () => fn ($retro) => Card::factory()->create([
        'retro_id' => $retro->id,
        'parent_card_id' => Card::factory()->create(['retro_id' => $retro->id])->id,
    ])->id,
    'another retro card' => fn () => fn () => Card::factory()->create()->id,
]);

it('only groups during the grouping phase', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [$user] = retroMember($retro);
    $lead = Card::factory()->create(['retro_id' => $retro->id]);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)
        ->putJson(route('retros.cards.group.update', [$retro, $card]), ['parent_card_id' => $lead->id])
        ->assertForbidden();
});

it('ungroups a card to the end of its column', function () {
    [$retro, $user] = groupingRetro();
    $lead = Card::factory()->create(['retro_id' => $retro->id, 'position' => 0]);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $lead->column_id, 'parent_card_id' => $lead->id]);

    $this->actingAs($user)->deleteJson(route('retros.cards.group.destroy', [$retro, $card]))->assertOk();

    expect($card->fresh()->parent_card_id)->toBeNull()
        ->and($card->fresh()->position)->toBe(1);
    Event::assertDispatched(CardUngrouped::class);
});

it('refuses to ungroup a top level card', function () {
    [$retro, $user] = groupingRetro();
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->deleteJson(route('retros.cards.group.destroy', [$retro, $card]))->assertUnprocessable();
});

it('does not leak authors of anonymous retros in grouping broadcasts', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->anonymous()->create();
    [$user] = retroMember($retro);
    $lead = Card::factory()->create(['retro_id' => $retro->id]);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->putJson(route('retros.cards.group.update', [$retro, $card]), ['parent_card_id' => $lead->id]);

    Event::assertDispatched(CardGrouped::class, fn (CardGrouped $event) => collect($event->cards)->every(fn (array $card) => $card['author'] === null));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/GroupingTest.php`
Expected: FAIL.

- [ ] **Step 3: Implement**

Events `CardGrouped(string $retroId, public array $cards)` → `card.grouped`, `CardUngrouped(string $retroId, public array $cards)` → `card.ungrouped` (same shape as Task 8).

`app/Actions/Retros/GroupCard.php`:

```php
<?php

namespace App\Actions\Retros;

use App\Models\Card;
use App\Models\Vote;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class GroupCard
{
    /**
     * @return Collection<int, Card>
     */
    public function group(Card $card, Card $lead): Collection
    {
        if ($lead->is($card)) {
            throw ValidationException::withMessages(['parent_card_id' => __('A card cannot be grouped with itself.')]);
        }

        if (! $lead->isTopLevel()) {
            throw ValidationException::withMessages(['parent_card_id' => __('Cards can only be grouped under a card that is not grouped itself.')]);
        }

        $movedCards = $card->children()->get()->push($card);

        Vote::query()->whereIn('card_id', $movedCards->pluck('id'))->update(['card_id' => $lead->id]);

        foreach ($movedCards as $moved) {
            $moved->update([
                'parent_card_id' => $lead->id,
                'column_id' => $lead->column_id,
            ]);
        }

        return $movedCards->push($lead);
    }

    /**
     * @return Collection<int, Card>
     */
    public function ungroup(Card $card): Collection
    {
        if ($card->isTopLevel()) {
            throw ValidationException::withMessages(['card' => __('This card is not grouped.')]);
        }

        $lastPosition = Card::query()
            ->where('column_id', $card->column_id)
            ->whereNull('parent_card_id')
            ->max('position');

        $card->update([
            'parent_card_id' => null,
            'position' => $lastPosition === null ? 0 : $lastPosition + 1,
        ]);

        return collect([$card]);
    }
}
```

`app/Http/Controllers/Retros/CardGroupsController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\GroupCard;
use App\Actions\Retros\PresentCard;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\CardGrouped;
use App\Events\Retros\CardUngrouped;
use App\Http\Controllers\Controller;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CardGroupsController extends Controller
{
    public function __construct(
        private GroupCard $groupCard,
        private PresentCard $presentCard,
    ) {}

    public function update(Request $request, Retro $retro, Card $card): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Grouping);

        $validated = $request->validate([
            'parent_card_id' => ['required', 'uuid', Rule::exists('cards', 'id')->where('retro_id', $retro->id)],
        ]);

        $changed = DB::transaction(function () use ($retro, $card, $validated): Collection {
            $changed = $this->groupCard->group($card, Card::findOrFail($validated['parent_card_id']));

            broadcast(new CardGrouped($retro->id, $this->present($changed, $retro, null)))->toOthers();

            return $changed;
        });

        return response()->json(['cards' => $this->present($changed, $retro, $participant)]);
    }

    public function destroy(Request $request, Retro $retro, Card $card): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Grouping);

        $changed = DB::transaction(function () use ($retro, $card): Collection {
            $changed = $this->groupCard->ungroup($card);

            broadcast(new CardUngrouped($retro->id, $this->present($changed, $retro, null)))->toOthers();

            return $changed;
        });

        return response()->json(['cards' => $this->present($changed, $retro, $participant)]);
    }

    /**
     * @param  Collection<int, Card>  $cards
     * @return array<int, array<string, mixed>>
     */
    private function present(Collection $cards, Retro $retro, ?Participant $viewer): array
    {
        return $cards->map(fn (Card $card) => $this->presentCard->handle($card, $retro, $viewer))->values()->all();
    }
}
```

Routes (group, `->whereUuid('card')`): `Route::put('cards/{card}/group', [CardGroupsController::class, 'update'])->name('retros.cards.group.update');` and `Route::delete('cards/{card}/group', [CardGroupsController::class, 'destroy'])->name('retros.cards.group.destroy');`

Add keys `A card cannot be grouped with itself.`, `Cards can only be grouped under a card that is not grouped itself.`, `This card is not grouped.` to the four lang files.

- [ ] **Step 4: Run tests, commit**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros` → PASS.

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse
git add -A && git commit -m "feat: group and ungroup cards with vote reassignment

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FcMxGGHCZcDTndQCc57VPC"
```

---

### Task 10: Voting

**Files:**
- Create: `app/Http/Controllers/Retros/CardVotesController.php`, `app/Events/Retros/{VoteCast,VoteRetracted}.php`
- Modify: `routes/web.php`, `lang/*.json`
- Test: `tests/Feature/Retros/VotingTest.php`

**Interfaces:**
- Consumes: `RetroGuard`, `Participant::current`.
- Produces: routes `retros.cards.votes.store` POST `cards/{card}/votes` → 201 `{cardId, myVotes, remainingVotes}`; `retros.cards.votes.destroy` DELETE `cards/{card}/votes` → 200 same shape. Events `VoteCast{votesCast}` (`vote.cast`), `VoteRetracted{votesCast}` (`vote.retracted`) — only the overall count.

Rules: Voting phase only; votes on top-level cards only; a participant never holds more than `votes_per_participant` votes in the retro (several on one card allowed); the check runs with the participant row locked. Retract removes one of the participant's votes on that card (422 if none).

- [ ] **Step 1: Write the failing test**

`vendor/bin/sail artisan make:test --pest Retros/VotingTest`:

```php
<?php

use App\Enums\RetroPhase;
use App\Events\Retros\VoteCast;
use App\Events\Retros\VoteRetracted;
use App\Models\Card;
use App\Models\Retro;
use App\Models\Vote;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function votingRetro(int $votes = 3): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => $votes]);
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    return [$retro, $user, $participant, $card];
}

it('casts votes and broadcasts only the overall count', function () {
    [$retro, $user, $participant, $card] = votingRetro();

    $this->actingAs($user)
        ->postJson(route('retros.cards.votes.store', [$retro, $card]))
        ->assertCreated()
        ->assertJson(['cardId' => $card->id, 'myVotes' => 1, 'remainingVotes' => 2]);

    Event::assertDispatched(VoteCast::class, fn (VoteCast $event) => $event->votesCast === 1
        && array_keys($event->broadcastWith()) === ['votesCast']);
});

it('allows several votes on one card up to the limit', function () {
    [$retro, $user, , $card] = votingRetro(2);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertCreated();
    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertCreated();

    $this->actingAs($user)
        ->postJson(route('retros.cards.votes.store', [$retro, $card]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['votes' => 'You have no votes left.']);
});

it('counts votes across the whole retro', function () {
    [$retro, $user, $participant, $card] = votingRetro(2);
    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertUnprocessable();
});

it('refuses votes after the limit was lowered', function () {
    [$retro, $user, $participant, $card] = votingRetro(5);
    Vote::factory()->count(3)->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);
    $retro->update(['votes_per_participant' => 2]);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertUnprocessable();
});

it('refuses votes on grouped cards and outside voting', function () {
    [$retro, $user, , $card] = votingRetro();
    $child = Card::factory()->create(['retro_id' => $retro->id, 'parent_card_id' => $card->id]);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $child]))->assertUnprocessable();

    $retro->update(['phase' => RetroPhase::Discussing]);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertForbidden();
});

it('retracts one of the participant votes on a card', function () {
    [$retro, $user, $participant, $card] = votingRetro();
    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $participant->id]);
    $othersVote = Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $this->actingAs($user)
        ->deleteJson(route('retros.cards.votes.destroy', [$retro, $card]))
        ->assertOk()
        ->assertJson(['myVotes' => 1, 'remainingVotes' => 2]);

    expect(Vote::find($othersVote->id))->not->toBeNull();
    Event::assertDispatched(VoteRetracted::class, fn (VoteRetracted $event) => $event->votesCast === 2);
});

it('refuses to retract a vote the participant never cast', function () {
    [$retro, $user, , $card] = votingRetro();
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $this->actingAs($user)->deleteJson(route('retros.cards.votes.destroy', [$retro, $card]))->assertUnprocessable();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/VotingTest.php`
Expected: FAIL.

- [ ] **Step 3: Implement**

Events `VoteCast(string $retroId, public int $votesCast)` → `vote.cast`, `['votesCast' => …]`; `VoteRetracted` same with `vote.retracted`.

`app/Http/Controllers/Retros/CardVotesController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\VoteCast;
use App\Events\Retros\VoteRetracted;
use App\Http\Controllers\Controller;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CardVotesController extends Controller
{
    public function store(Request $request, Retro $retro, Card $card): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Voting);

        if (! $card->isTopLevel()) {
            throw ValidationException::withMessages(['votes' => __('Votes can only be cast on cards that are not grouped under another card.')]);
        }

        DB::transaction(function () use ($retro, $card, $participant): void {
            Participant::query()->whereKey($participant->id)->lockForUpdate()->first();

            $used = $retro->votes()->where('participant_id', $participant->id)->count();

            if ($used >= $retro->votes_per_participant) {
                throw ValidationException::withMessages(['votes' => __('You have no votes left.')]);
            }

            $retro->votes()->create([
                'card_id' => $card->id,
                'participant_id' => $participant->id,
            ]);

            broadcast(new VoteCast($retro->id, $retro->votes()->count()))->toOthers();
        });

        return response()->json($this->tally($retro, $card, $participant), 201);
    }

    public function destroy(Request $request, Retro $retro, Card $card): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Voting);

        DB::transaction(function () use ($retro, $card, $participant): void {
            $vote = $card->votes()->where('participant_id', $participant->id)->latest()->first();

            if ($vote === null) {
                throw ValidationException::withMessages(['votes' => __('You have not voted for this card.')]);
            }

            $vote->delete();

            broadcast(new VoteRetracted($retro->id, $retro->votes()->count()))->toOthers();
        });

        return response()->json($this->tally($retro, $card, $participant));
    }

    /**
     * @return array{
     *     cardId: string,
     *     myVotes: int,
     *     remainingVotes: int
     * }
     */
    private function tally(Retro $retro, Card $card, Participant $participant): array
    {
        $used = $retro->votes()->where('participant_id', $participant->id)->count();

        return [
            'cardId' => $card->id,
            'myVotes' => $card->votes()->where('participant_id', $participant->id)->count(),
            'remainingVotes' => max(0, $retro->votes_per_participant - $used),
        ];
    }
}
```

`Vote` needs `retro_id` settable through `$retro->votes()->create()` — the relation sets it automatically; `card_id`/`participant_id` are fillable.

Routes (group, `->whereUuid('card')`): `Route::post('cards/{card}/votes', [CardVotesController::class, 'store'])->name('retros.cards.votes.store');` and `Route::delete('cards/{card}/votes', [CardVotesController::class, 'destroy'])->name('retros.cards.votes.destroy');`

Add keys `Votes can only be cast on cards that are not grouped under another card.`, `You have no votes left.`, `You have not voted for this card.` to the four lang files.

- [ ] **Step 4: Run tests, commit**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros` → PASS.

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse
git add -A && git commit -m "feat: cast and retract votes within the participant limit

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FcMxGGHCZcDTndQCc57VPC"
```

---

### Task 11: Facilitation — phases, timer, highlight, settings, guest link, facilitator, deletion

**Files:**
- Create: `app/Http/Controllers/Retros/{RetroPhasesController,RetroTimersController,RetroHighlightsController,RetroSettingsController,RetroGuestTokensController,RetroFacilitatorsController}.php`, `app/Events/Retros/{PhaseChanged,TimerChanged,CardHighlighted,RetroSettingsChanged,RetroDeleted}.php`
- Modify: `app/Http/Controllers/Retros/RetrosController.php` (add `destroy`), `routes/web.php`, `lang/*.json`
- Test: `tests/Feature/Retros/FacilitationTest.php`

**Interfaces:**
- Consumes: `RetroGuard`, `Participant::current`, `ResolveParticipant`-equivalent team check (`User::can('view', $team)`).
- Produces routes (group), all facilitator-only:
  - `retros.phase.update` PUT `phase` `{phase}` → `{phase}`; event `PhaseChanged{phase}` (`phase.changed`)
  - `retros.timer.update` PUT `timer` `{seconds: int 10–7200 | null}` → `{timerEndsAt}`; event `TimerChanged{timerEndsAt}` (`timer.changed`)
  - `retros.highlight.update` PUT `highlight` `{card_id | null}` → `{highlightedCardId}`; event `CardHighlighted{cardId}` (`card.highlighted`)
  - `retros.settings.update` PATCH `settings` `{title?, is_anonymous?, votes_per_participant?, guest_access_enabled?}` → 204; event `RetroSettingsChanged` (`settings.changed`, empty payload → clients refetch)
  - `retros.guest-token.store` POST `guest-token` → `{guestUrl}`; event `RetroSettingsChanged`
  - `retros.facilitator.update` PUT `facilitator` `{user_id}` → 204; event `RetroSettingsChanged`
  - `retros.destroy` DELETE `/retros/{retro}` → 204; event `RetroDeleted` (`retro.deleted`)

Rules: phase changes only to an adjacent phase; entering `Completed` sets `completed_at` and clears the timer; leaving it clears `completed_at`. Timer not allowed in `Completed`. Highlight only in `Discussing` and only top-level cards of the retro. Settings: `title` 1–120; `is_anonymous` may turn on anytime, off only when the retro has no cards (422 otherwise); `votes_per_participant` 1–20 only in Writing/Grouping (403 otherwise); `guest_access_enabled` anytime. Facilitator transfer: the target user must be allowed to view the team (member or workspace manager); their participant is created if needed; guests can never facilitate.

- [ ] **Step 1: Write the failing test**

`vendor/bin/sail artisan make:test --pest Retros/FacilitationTest`:

```php
<?php

use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Events\Retros\CardHighlighted;
use App\Events\Retros\PhaseChanged;
use App\Events\Retros\RetroDeleted;
use App\Events\Retros\RetroSettingsChanged;
use App\Events\Retros\TimerChanged;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function facilitatedRetro(RetroPhase $phase = RetroPhase::Writing): array
{
    $retro = Retro::factory()->inPhase($phase)->create();
    [$user, $participant] = retroFacilitator($retro);

    return [$retro->fresh(), $user, $participant];
}

it('moves to adjacent phases only', function () {
    [$retro, $user] = facilitatedRetro();

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'grouping'])->assertOk();
    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'discussing'])->assertUnprocessable();
    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'writing'])->assertOk();

    Event::assertDispatched(PhaseChanged::class, fn (PhaseChanged $event) => $event->phase === 'grouping');
});

it('completes and reopens a retro', function () {
    [$retro, $user] = facilitatedRetro(RetroPhase::Discussing);
    $retro->update(['timer_ends_at' => now()->addMinutes(5)]);

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'completed'])->assertOk();

    expect($retro->fresh()->completed_at)->not->toBeNull()
        ->and($retro->fresh()->timer_ends_at)->toBeNull();

    $this->actingAs($user)->putJson(route('retros.phase.update', $retro), ['phase' => 'discussing'])->assertOk();

    expect($retro->fresh()->completed_at)->toBeNull();
});

it('reserves facilitation to the facilitator', function (Closure $request) {
    $retro = Retro::factory()->create();
    retroFacilitator($retro);
    [$user] = retroMember($retro);

    $request($this->actingAs($user), $retro)->assertForbidden();
})->with([
    'phase' => fn () => fn ($test, $retro) => $test->putJson(route('retros.phase.update', $retro), ['phase' => 'grouping']),
    'timer' => fn () => fn ($test, $retro) => $test->putJson(route('retros.timer.update', $retro), ['seconds' => 60]),
    'settings' => fn () => fn ($test, $retro) => $test->patchJson(route('retros.settings.update', $retro), ['title' => 'Mine']),
    'guest token' => fn () => fn ($test, $retro) => $test->postJson(route('retros.guest-token.store', $retro)),
    'delete' => fn () => fn ($test, $retro) => $test->deleteJson(route('retros.destroy', $retro)),
]);

it('sets and clears the timer', function () {
    [$retro, $user] = facilitatedRetro();
    $this->freezeTime();

    $this->actingAs($user)
        ->putJson(route('retros.timer.update', $retro), ['seconds' => 300])
        ->assertOk()
        ->assertJsonPath('timerEndsAt', now()->addSeconds(300)->toIso8601String());

    $this->actingAs($user)->putJson(route('retros.timer.update', $retro), ['seconds' => null])->assertOk();

    expect($retro->fresh()->timer_ends_at)->toBeNull();
    Event::assertDispatched(TimerChanged::class, 2);
});

it('validates timer durations and refuses them once completed', function () {
    [$retro, $user] = facilitatedRetro();

    $this->actingAs($user)->putJson(route('retros.timer.update', $retro), ['seconds' => 5])->assertUnprocessable();

    $retro->update(['phase' => RetroPhase::Completed]);

    $this->actingAs($user)->putJson(route('retros.timer.update', $retro), ['seconds' => 60])->assertForbidden();
});

it('highlights top level cards while discussing', function () {
    [$retro, $user] = facilitatedRetro(RetroPhase::Discussing);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    $child = Card::factory()->create(['retro_id' => $retro->id, 'parent_card_id' => $card->id]);

    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $card->id])->assertOk();
    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $child->id])->assertUnprocessable();
    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => Card::factory()->create()->id])->assertUnprocessable();

    expect($retro->fresh()->highlighted_card_id)->toBe($card->id);
    Event::assertDispatched(CardHighlighted::class, fn (CardHighlighted $event) => $event->cardId === $card->id);

    $retro->update(['phase' => RetroPhase::Voting]);

    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $card->id])->assertForbidden();
});

it('updates settings and asks clients to refetch', function () {
    [$retro, $user] = facilitatedRetro();

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), [
        'title' => 'Renamed',
        'is_anonymous' => true,
        'votes_per_participant' => 3,
        'guest_access_enabled' => true,
    ])->assertNoContent();

    expect($retro->fresh()->only(['title', 'is_anonymous', 'votes_per_participant', 'guest_access_enabled']))->toBe([
        'title' => 'Renamed',
        'is_anonymous' => true,
        'votes_per_participant' => 3,
        'guest_access_enabled' => true,
    ]);
    Event::assertDispatched(RetroSettingsChanged::class, fn (RetroSettingsChanged $event) => $event->broadcastWith() === []);
});

it('only turns anonymity off before any card exists', function () {
    [$retro, $user] = facilitatedRetro();
    $retro->update(['is_anonymous' => true]);
    Card::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)
        ->patchJson(route('retros.settings.update', $retro), ['is_anonymous' => false])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['is_anonymous' => 'Anonymity can only be turned off before any card is written.']);
});

it('only changes the vote allowance before voting', function () {
    [$retro, $user] = facilitatedRetro(RetroPhase::Voting);

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['votes_per_participant' => 9])->assertForbidden();

    $retro->update(['phase' => RetroPhase::Grouping]);

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['votes_per_participant' => 21])->assertUnprocessable();
});

it('regenerates the guest link and locks out existing guests', function () {
    [$retro, $user] = facilitatedRetro();
    $retro->update(['guest_access_enabled' => true]);
    $oldToken = $retro->guest_token;

    $response = $this->actingAs($user)->postJson(route('retros.guest-token.store', $retro))->assertOk();

    expect($retro->fresh()->guest_token)->not->toBe($oldToken)
        ->and($response->json('guestUrl'))->toBe(route('retros.join.show', $retro->fresh()->guest_token));
    Event::assertDispatched(RetroSettingsChanged::class);
});

it('locks guests out when guest access is disabled', function () {
    [$retro, $user] = facilitatedRetro();
    $retro->update(['guest_access_enabled' => true]);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))->getJson(route('retros.snapshot.show', $retro))->assertOk();

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['guest_access_enabled' => false]);
    auth()->logout();

    $this->withCookies(retroGuestCookie($guest))->getJson(route('retros.snapshot.show', $retro))->assertForbidden();
});

it('hands facilitation to a team member or workspace manager', function () {
    [$retro, $user] = facilitatedRetro();
    $admin = User::factory()->create();
    $retro->team->workspace->members()->attach($admin, ['role' => WorkspaceRole::Admin->value]);

    $this->actingAs($user)->putJson(route('retros.facilitator.update', $retro), ['user_id' => $admin->id])->assertNoContent();

    expect($retro->fresh()->facilitator->user_id)->toBe($admin->id);
});

it('refuses facilitators outside the team', function () {
    [$retro, $user] = facilitatedRetro();

    $this->actingAs($user)
        ->putJson(route('retros.facilitator.update', $retro), ['user_id' => User::factory()->create()->id])
        ->assertUnprocessable();
});

it('deletes the retro', function () {
    [$retro, $user] = facilitatedRetro();

    $this->actingAs($user)->deleteJson(route('retros.destroy', $retro))->assertNoContent();

    expect(Retro::find($retro->id))->toBeNull();
    Event::assertDispatched(RetroDeleted::class, fn (RetroDeleted $event) => $event->retroId === $retro->id);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/FacilitationTest.php`
Expected: FAIL.

- [ ] **Step 3: Events**

- `PhaseChanged(string $retroId, public string $phase)` → `phase.changed`, `['phase' => …]`
- `TimerChanged(string $retroId, public ?string $timerEndsAt)` → `timer.changed`, `['timerEndsAt' => …]`
- `CardHighlighted(string $retroId, public ?string $cardId)` → `card.highlighted`, `['cardId' => …]`
- `RetroSettingsChanged(string $retroId)` → `settings.changed`, `[]`
- `RetroDeleted(string $retroId)` → `retro.deleted`, `[]`

- [ ] **Step 4: Controllers**

`RetroPhasesController`:

```php
public function update(Request $request, Retro $retro): JsonResponse
{
    RetroGuard::facilitator($retro, Participant::current($request));

    $validated = $request->validate([
        'phase' => ['required', Rule::enum(RetroPhase::class)],
    ]);

    $phase = RetroPhase::from($validated['phase']);

    if (! $retro->phase->isAdjacentTo($phase)) {
        throw ValidationException::withMessages(['phase' => __('The retrospective can only move to the previous or next phase.')]);
    }

    DB::transaction(function () use ($retro, $phase): void {
        $isCompleting = $phase === RetroPhase::Completed;

        $retro->update([
            'phase' => $phase,
            'completed_at' => $isCompleting ? now() : null,
            'timer_ends_at' => $isCompleting ? null : $retro->timer_ends_at,
        ]);

        broadcast(new PhaseChanged($retro->id, $phase->value))->toOthers();
    });

    return response()->json(['phase' => $phase->value]);
}
```

`RetroTimersController`:

```php
public function update(Request $request, Retro $retro): JsonResponse
{
    RetroGuard::facilitator($retro, Participant::current($request));
    RetroGuard::phase($retro, RetroPhase::Writing, RetroPhase::Grouping, RetroPhase::Voting, RetroPhase::Discussing);

    $validated = $request->validate([
        'seconds' => ['present', 'nullable', 'integer', 'min:10', 'max:7200'],
    ]);

    $endsAt = $validated['seconds'] === null ? null : now()->addSeconds((int) $validated['seconds']);

    DB::transaction(function () use ($retro, $endsAt): void {
        $retro->update(['timer_ends_at' => $endsAt]);

        broadcast(new TimerChanged($retro->id, $endsAt?->toIso8601String()))->toOthers();
    });

    return response()->json(['timerEndsAt' => $endsAt?->toIso8601String()]);
}
```

`RetroHighlightsController`:

```php
public function update(Request $request, Retro $retro): JsonResponse
{
    RetroGuard::facilitator($retro, Participant::current($request));
    RetroGuard::phase($retro, RetroPhase::Discussing);

    $validated = $request->validate([
        'card_id' => [
            'present',
            'nullable',
            'uuid',
            Rule::exists('cards', 'id')->where('retro_id', $retro->id)->whereNull('parent_card_id'),
        ],
    ]);

    DB::transaction(function () use ($retro, $validated): void {
        $retro->update(['highlighted_card_id' => $validated['card_id']]);

        broadcast(new CardHighlighted($retro->id, $validated['card_id']))->toOthers();
    });

    return response()->json(['highlightedCardId' => $validated['card_id']]);
}
```

`RetroSettingsController`:

```php
public function update(Request $request, Retro $retro): Response
{
    RetroGuard::facilitator($retro, Participant::current($request));

    $validated = $request->validate([
        'title' => ['sometimes', 'required', 'string', 'max:120'],
        'is_anonymous' => ['sometimes', 'boolean'],
        'votes_per_participant' => ['sometimes', 'integer', 'min:1', 'max:20'],
        'guest_access_enabled' => ['sometimes', 'boolean'],
    ]);

    if (array_key_exists('votes_per_participant', $validated)) {
        RetroGuard::phase($retro, RetroPhase::Writing, RetroPhase::Grouping);
    }

    $isDisablingAnonymity = array_key_exists('is_anonymous', $validated)
        && ! $validated['is_anonymous']
        && $retro->is_anonymous;

    if ($isDisablingAnonymity && $retro->cards()->exists()) {
        throw ValidationException::withMessages(['is_anonymous' => __('Anonymity can only be turned off before any card is written.')]);
    }

    DB::transaction(function () use ($retro, $validated): void {
        $retro->update($validated);

        broadcast(new RetroSettingsChanged($retro->id))->toOthers();
    });

    return response()->noContent();
}
```

`RetroGuestTokensController`:

```php
public function store(Request $request, Retro $retro): JsonResponse
{
    RetroGuard::facilitator($retro, Participant::current($request));

    DB::transaction(function () use ($retro): void {
        $retro->update(['guest_token' => Str::random(40)]);

        broadcast(new RetroSettingsChanged($retro->id))->toOthers();
    });

    return response()->json(['guestUrl' => route('retros.join.show', $retro->guest_token)]);
}
```

`RetroFacilitatorsController`:

```php
public function update(Request $request, Retro $retro): Response
{
    RetroGuard::facilitator($retro, Participant::current($request));

    $validated = $request->validate([
        'user_id' => ['required', 'uuid', 'exists:users,id'],
    ]);

    $user = User::findOrFail($validated['user_id']);

    if (! $user->can('view', $retro->team)) {
        throw ValidationException::withMessages(['user_id' => __('The facilitator must be a member of this team.')]);
    }

    DB::transaction(function () use ($retro, $user): void {
        $participant = Participant::query()->firstOrCreate(['retro_id' => $retro->id, 'user_id' => $user->id]);

        $retro->update(['facilitator_participant_id' => $participant->id]);

        broadcast(new RetroSettingsChanged($retro->id))->toOthers();
    });

    return response()->noContent();
}
```

`RetrosController::destroy`:

```php
public function destroy(Request $request, Retro $retro): Response
{
    RetroGuard::facilitator($retro, Participant::current($request));

    DB::transaction(function () use ($retro): void {
        $retroId = $retro->id;

        $retro->delete();

        broadcast(new RetroDeleted($retroId))->toOthers();
    });

    return response()->noContent();
}
```

Deleting a retro with `facilitator_participant_id` / `highlighted_card_id` FKs pointing into its own children works because both FKs are `nullOnDelete` and the children cascade from `retros`. If Postgres reports an ordering problem, null both columns before `delete()`.

Routes (group): `Route::delete('/', [RetrosController::class, 'destroy'])->name('retros.destroy');`, `Route::put('phase', …)->name('retros.phase.update');`, `Route::put('timer', …)->name('retros.timer.update');`, `Route::put('highlight', …)->name('retros.highlight.update');`, `Route::patch('settings', …)->name('retros.settings.update');`, `Route::post('guest-token', …)->name('retros.guest-token.store');`, `Route::put('facilitator', …)->name('retros.facilitator.update');`

Add keys `The retrospective can only move to the previous or next phase.`, `Anonymity can only be turned off before any card is written.`, `The facilitator must be a member of this team.` to the four lang files.

- [ ] **Step 5: Run tests, commit**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros` → PASS.

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse
git add -A && git commit -m "feat: add facilitator controls for phases, timer, settings and guests

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FcMxGGHCZcDTndQCc57VPC"
```

---

### Task 12: Column editing

**Files:**
- Create: `app/Http/Controllers/Retros/ColumnsController.php`, `app/Http/Controllers/Retros/ColumnOrdersController.php`, `app/Events/Retros/ColumnsChanged.php`
- Modify: `routes/web.php`, `lang/*.json`
- Test: `tests/Feature/Retros/ColumnsTest.php`

**Interfaces:**
- Produces routes (group, facilitator-only, Writing only): `retros.columns.store` POST `columns` `{title, color}` → 201 `{columns}`; `retros.columns.update` PATCH `columns/{column}` `{title?, color?}` → `{columns}`; `retros.columns.destroy` DELETE `columns/{column}` → `{columns}`; `retros.columns.order.update` PUT `column-order` `{column_ids: string[]}` (exactly the retro's columns) → `{columns}`. Event `ColumnsChanged{columns}` (`columns.changed`, full ordered list `{id, title, color, position}`).

Rules (spec §2): adding and reordering always allowed in Writing; renaming and removing require the column to have no cards (422). Title 1–60 chars; color one of `ColumnColor`. New columns go last; removal resequences positions.

- [ ] **Step 1: Write the failing test**

`vendor/bin/sail artisan make:test --pest Retros/ColumnsTest`:

```php
<?php

use App\Enums\RetroPhase;
use App\Events\Retros\ColumnsChanged;
use App\Models\Card;
use App\Models\Column;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function columnsRetro(): array
{
    $retro = Retro::factory()->create();
    [$user] = retroFacilitator($retro);
    $first = Column::factory()->create(['retro_id' => $retro->id, 'position' => 0, 'title' => 'First']);
    $second = Column::factory()->create(['retro_id' => $retro->id, 'position' => 1, 'title' => 'Second']);

    return [$retro->fresh(), $user, $first, $second];
}

it('adds a column at the end', function () {
    [$retro, $user] = columnsRetro();

    $this->actingAs($user)
        ->postJson(route('retros.columns.store', $retro), ['title' => 'Kudos', 'color' => 'purple'])
        ->assertCreated()
        ->assertJsonPath('columns.2.title', 'Kudos')
        ->assertJsonPath('columns.2.position', 2);

    Event::assertDispatched(ColumnsChanged::class, fn (ColumnsChanged $event) => count($event->columns) === 3);
});

it('renames and removes empty columns only', function () {
    [$retro, $user, $first, $second] = columnsRetro();
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $first->id]);

    $this->actingAs($user)->patchJson(route('retros.columns.update', [$retro, $first]), ['title' => 'New'])->assertUnprocessable();
    $this->actingAs($user)->deleteJson(route('retros.columns.destroy', [$retro, $first]))->assertUnprocessable();

    $this->actingAs($user)->patchJson(route('retros.columns.update', [$retro, $second]), ['title' => 'Renamed', 'color' => 'red'])->assertOk();
    $this->actingAs($user)->deleteJson(route('retros.columns.destroy', [$retro, $second]))->assertOk()->assertJsonCount(1, 'columns');
});

it('resequences positions after removing a column', function () {
    [$retro, $user, $first, $second] = columnsRetro();

    $this->actingAs($user)->deleteJson(route('retros.columns.destroy', [$retro, $first]))->assertOk();

    expect($second->fresh()->position)->toBe(0);
});

it('reorders columns with the complete list only', function () {
    [$retro, $user, $first, $second] = columnsRetro();

    $this->actingAs($user)
        ->putJson(route('retros.columns.order.update', $retro), ['column_ids' => [$second->id, $first->id]])
        ->assertOk()
        ->assertJsonPath('columns.0.id', $second->id);

    $this->actingAs($user)->putJson(route('retros.columns.order.update', $retro), ['column_ids' => [$first->id]])->assertUnprocessable();
    $this->actingAs($user)->putJson(route('retros.columns.order.update', $retro), ['column_ids' => [$first->id, Column::factory()->create()->id]])->assertUnprocessable();
});

it('validates titles and colors', function (array $payload) {
    [$retro, $user] = columnsRetro();

    $this->actingAs($user)->postJson(route('retros.columns.store', $retro), $payload)->assertUnprocessable();
})->with([
    [['title' => '', 'color' => 'green']],
    [['title' => str_repeat('a', 61), 'color' => 'green']],
    [['title' => 'Ok', 'color' => 'pink']],
]);

it('restricts column editing to the facilitator while writing', function () {
    [$retro, , $first] = columnsRetro();
    [$member] = retroMember($retro);

    $this->actingAs($member)->postJson(route('retros.columns.store', $retro), ['title' => 'X', 'color' => 'green'])->assertForbidden();

    $retro->update(['phase' => RetroPhase::Grouping]);
    $facilitator = $retro->facilitator->user;

    $this->actingAs($facilitator)->postJson(route('retros.columns.store', $retro), ['title' => 'X', 'color' => 'green'])->assertForbidden();
});

it('returns 404 for columns of another retro', function () {
    [$retro, $user] = columnsRetro();

    $this->actingAs($user)
        ->patchJson(route('retros.columns.update', [$retro, Column::factory()->create()]), ['title' => 'X'])
        ->assertNotFound();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/ColumnsTest.php`
Expected: FAIL.

- [ ] **Step 3: Implement**

Event `ColumnsChanged(string $retroId, public array $columns)` → `columns.changed`, `['columns' => …]`.

`ColumnsController`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Enums\ColumnColor;
use App\Enums\RetroPhase;
use App\Events\Retros\ColumnsChanged;
use App\Http\Controllers\Controller;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ColumnsController extends Controller
{
    public function store(Request $request, Retro $retro): JsonResponse
    {
        $this->authorizeEditing($request, $retro);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:60'],
            'color' => ['required', Rule::enum(ColumnColor::class)],
        ]);

        return $this->respond($retro, function () use ($retro, $validated): void {
            $retro->columns()->create([
                ...$validated,
                'position' => $retro->columns()->count(),
            ]);
        }, 201);
    }

    public function update(Request $request, Retro $retro, Column $column): JsonResponse
    {
        $this->authorizeEditing($request, $retro);
        $this->ensureEmpty($column);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:60'],
            'color' => ['sometimes', Rule::enum(ColumnColor::class)],
        ]);

        return $this->respond($retro, fn () => $column->update($validated));
    }

    public function destroy(Request $request, Retro $retro, Column $column): JsonResponse
    {
        $this->authorizeEditing($request, $retro);
        $this->ensureEmpty($column);

        return $this->respond($retro, function () use ($retro, $column): void {
            $column->delete();

            foreach ($retro->columns()->get()->values() as $position => $remaining) {
                $remaining->update(['position' => $position]);
            }
        });
    }

    private function authorizeEditing(Request $request, Retro $retro): void
    {
        RetroGuard::facilitator($retro, Participant::current($request));
        RetroGuard::phase($retro, RetroPhase::Writing);
    }

    private function ensureEmpty(Column $column): void
    {
        if ($column->cards()->exists()) {
            throw ValidationException::withMessages(['column' => __('This column still has cards.')]);
        }
    }

    private function respond(Retro $retro, callable $change, int $status = 200): JsonResponse
    {
        $columns = DB::transaction(function () use ($retro, $change): array {
            $change();

            $columns = $retro->columns()->get()->map(fn (Column $column) => [
                'id' => $column->id,
                'title' => $column->title,
                'color' => $column->color->value,
                'position' => $column->position,
            ])->all();

            broadcast(new ColumnsChanged($retro->id, $columns))->toOthers();

            return $columns;
        });

        return response()->json(['columns' => $columns], $status);
    }
}
```

`ColumnOrdersController`:

```php
public function update(Request $request, Retro $retro): JsonResponse
{
    RetroGuard::facilitator($retro, Participant::current($request));
    RetroGuard::phase($retro, RetroPhase::Writing);

    $validated = $request->validate([
        'column_ids' => ['required', 'array'],
        'column_ids.*' => ['uuid', 'distinct'],
    ]);

    $currentIds = $retro->columns()->pluck('id')->sort()->values()->all();
    $requestedIds = collect($validated['column_ids'])->sort()->values()->all();

    if ($currentIds !== $requestedIds) {
        throw ValidationException::withMessages(['column_ids' => __('Send every column of this retrospective exactly once.')]);
    }

    $columns = DB::transaction(function () use ($retro, $validated): array {
        foreach ($validated['column_ids'] as $position => $columnId) {
            $retro->columns()->whereKey($columnId)->update(['position' => $position]);
        }

        $columns = $retro->columns()->get()->map(fn (Column $column) => [
            'id' => $column->id,
            'title' => $column->title,
            'color' => $column->color->value,
            'position' => $column->position,
        ])->all();

        broadcast(new ColumnsChanged($retro->id, $columns))->toOthers();

        return $columns;
    });

    return response()->json(['columns' => $columns]);
}
```

The column-array mapping is duplicated between the two controllers: extract it into a small `PresentColumns::handle(Retro $retro): array` action in `app/Actions/Retros/` and use it in both controllers **and** `BuildBoardSnapshot` (replace its inline mapping).

Routes (group; `->whereUuid('column')` on column routes): `Route::post('columns', …)->name('retros.columns.store');`, `Route::patch('columns/{column}', …)->name('retros.columns.update');`, `Route::delete('columns/{column}', …)->name('retros.columns.destroy');`, `Route::put('column-order', [ColumnOrdersController::class, 'update'])->name('retros.columns.order.update');`

Add keys `This column still has cards.`, `Send every column of this retrospective exactly once.` to the four lang files.

- [ ] **Step 4: Run tests, commit**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros` → PASS.

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse
git add -A && git commit -m "feat: let facilitators edit retro columns while writing

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FcMxGGHCZcDTndQCc57VPC"
```

---

### Task 13: Action items

**Files:**
- Create: `app/Http/Controllers/Retros/ActionItemsController.php`, `app/Events/Retros/{ActionItemSaved,ActionItemDeleted}.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/Retros/ActionItemsTest.php`

**Interfaces:**
- Consumes: `PresentActionItem` (Task 3).
- Produces routes (group; `->whereUuid('actionItem')`): `retros.action-items.store` POST `action-items` `{content, assignee_participant_id?}` → 201 `{actionItem}`; `retros.action-items.update` PATCH `action-items/{actionItem}` `{content?, assignee_participant_id?, is_done?}` → `{actionItem}`; `retros.action-items.destroy` DELETE `action-items/{actionItem}` → 204. Events `ActionItemSaved{actionItem}` (`action-item.saved`), `ActionItemDeleted{actionItemId}` (`action-item.deleted`).

Rules (spec §4, AC30): any participant (guests included) may create, edit, complete and delete action items during `Discussing`; `Completed` is read-only. Content 1–500 chars; the assignee must be a participant of the same retro.

- [ ] **Step 1: Write the failing test**

`vendor/bin/sail artisan make:test --pest Retros/ActionItemsTest`:

```php
<?php

use App\Enums\RetroPhase;
use App\Events\Retros\ActionItemDeleted;
use App\Events\Retros\ActionItemSaved;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('creates, assigns, completes and deletes action items while discussing', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user, $participant] = retroMember($retro);

    $id = $this->actingAs($user)
        ->postJson(route('retros.action-items.store', $retro), ['content' => 'Speed up CI', 'assignee_participant_id' => $participant->id])
        ->assertCreated()
        ->assertJsonPath('actionItem.assignee.id', $participant->id)
        ->json('actionItem.id');

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.update', [$retro, $id]), ['is_done' => true, 'assignee_participant_id' => null])
        ->assertOk()
        ->assertJsonPath('actionItem.isDone', true)
        ->assertJsonPath('actionItem.assignee', null);

    $this->actingAs($user)->deleteJson(route('retros.action-items.destroy', [$retro, $id]))->assertNoContent();

    expect(ActionItem::find($id))->toBeNull();
    Event::assertDispatched(ActionItemSaved::class, 2);
    Event::assertDispatched(ActionItemDeleted::class, fn (ActionItemDeleted $event) => $event->actionItemId === $id);
});

it('lets guests manage action items', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->withGuestAccess()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))
        ->postJson(route('retros.action-items.store', $retro), ['content' => 'From a guest'])
        ->assertCreated();
});

it('keeps completed retros read-only and other phases closed', function (RetroPhase $phase) {
    $retro = Retro::factory()->inPhase($phase)->create();
    [$user] = retroMember($retro);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)->postJson(route('retros.action-items.store', $retro), ['content' => 'X'])->assertForbidden();
    $this->actingAs($user)->patchJson(route('retros.action-items.update', [$retro, $item]), ['is_done' => true])->assertForbidden();
    $this->actingAs($user)->deleteJson(route('retros.action-items.destroy', [$retro, $item]))->assertForbidden();
})->with([RetroPhase::Voting, RetroPhase::Completed]);

it('only assigns participants of the same retro', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('retros.action-items.store', $retro), ['content' => 'X', 'assignee_participant_id' => Participant::factory()->create()->id])
        ->assertUnprocessable();
});

it('validates content length', function (string $content) {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)->postJson(route('retros.action-items.store', $retro), ['content' => $content])->assertUnprocessable();
})->with(['', str_repeat('a', 501)]);

it('returns 404 for action items of another retro', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.update', [$retro, ActionItem::factory()->create()]), ['is_done' => true])
        ->assertNotFound();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/ActionItemsTest.php`
Expected: FAIL.

- [ ] **Step 3: Implement**

Events `ActionItemSaved(string $retroId, public array $actionItem)` → `action-item.saved`, `['actionItem' => …]`; `ActionItemDeleted(string $retroId, public string $actionItemId)` → `action-item.deleted`, `['actionItemId' => …]`.

`ActionItemsController`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\PresentActionItem;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\ActionItemDeleted;
use App\Events\Retros\ActionItemSaved;
use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ActionItemsController extends Controller
{
    public function __construct(private PresentActionItem $presentActionItem) {}

    public function store(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Discussing);

        $validated = $request->validate([
            'content' => ['required', 'string', 'max:500'],
            'assignee_participant_id' => $this->assigneeRules($retro),
        ]);

        $actionItem = DB::transaction(function () use ($retro, $participant, $validated): ActionItem {
            $actionItem = $retro->actionItems()->create([
                ...$validated,
                'created_by_participant_id' => $participant->id,
            ]);

            broadcast(new ActionItemSaved($retro->id, $this->presentActionItem->handle($actionItem)))->toOthers();

            return $actionItem;
        });

        return response()->json(['actionItem' => $this->presentActionItem->handle($actionItem)], 201);
    }

    public function update(Request $request, Retro $retro, ActionItem $actionItem): JsonResponse
    {
        Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Discussing);

        $validated = $request->validate([
            'content' => ['sometimes', 'required', 'string', 'max:500'],
            'assignee_participant_id' => ['sometimes', ...$this->assigneeRules($retro)],
            'is_done' => ['sometimes', 'boolean'],
        ]);

        DB::transaction(function () use ($retro, $actionItem, $validated): void {
            $actionItem->update($validated);

            broadcast(new ActionItemSaved($retro->id, $this->presentActionItem->handle($actionItem->fresh('assignee.user'))))->toOthers();
        });

        return response()->json(['actionItem' => $this->presentActionItem->handle($actionItem->fresh('assignee.user'))]);
    }

    public function destroy(Request $request, Retro $retro, ActionItem $actionItem): Response
    {
        Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Discussing);

        DB::transaction(function () use ($retro, $actionItem): void {
            $actionItem->delete();

            broadcast(new ActionItemDeleted($retro->id, $actionItem->id))->toOthers();
        });

        return response()->noContent();
    }

    /**
     * @return array<int, mixed>
     */
    private function assigneeRules(Retro $retro): array
    {
        return ['nullable', 'uuid', Rule::exists('participants', 'id')->where('retro_id', $retro->id)];
    }
}
```

Routes (group): `Route::post('action-items', …)->name('retros.action-items.store');`, `Route::patch('action-items/{actionItem}', …)->name('retros.action-items.update');`, `Route::delete('action-items/{actionItem}', …)->name('retros.action-items.destroy');` — `{actionItem}` resolves through `$retro->actionItems()` via `scopeBindings()`.

- [ ] **Step 4: Run tests, commit**

Run: `vendor/bin/sail artisan test --compact` → all PASS.

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse
git add -A && git commit -m "feat: manage action items while discussing

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FcMxGGHCZcDTndQCc57VPC"
```

---

## Spec coverage (Plan 3)

| Spec item | Task |
|---|---|
| §2 tables, enums, participant model, templates | 1 |
| AC11 create from template, creator facilitator + participant | 5 |
| AC12 facilitator-only actions | 11, 12 |
| AC13 phase rules on every mutation | 8, 9, 10, 11, 12, 13 |
| AC14 vote limit, retract frees a vote | 10 |
| AC15 grouping one level, votes top-level, reassignment | 9, 10 |
| AC16 completed read-only, reopen to discussing | 11, 13 |
| AC17–AC20 guests | 4, 6 |
| AC21 broadcast after commit excluding sender | 7–13 |
| AC22–AC24 redaction in snapshot and payloads | 3, 8, 9, 10 |
| AC25 phase / settings change → refetch signal | 11 |
| AC28 timer (server) | 11 |
| AC29 highlight (server) | 11 |
| AC30 action items (server) | 13 |
| Avatars, presence data | 2, 7 |
| AC26, AC27, board UI | Plan 4 |
