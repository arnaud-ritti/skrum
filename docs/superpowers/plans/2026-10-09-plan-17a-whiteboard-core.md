# Whiteboard Core (Plan 17a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A team member creates a whiteboard from the team page and edits it live with other members and guests on an Excalidraw canvas backed by server-owned elements.

**Architecture:** A whiteboard is a room like a poker game: its own tables, a parallel `whiteboard_members` table, a middleware that resolves the member, one snapshot builder, a presence channel. The server stores one row per Excalidraw element and accepts a write only when its `version` beats the stored one; every accepted write bumps a per-board `seq` that clients use to detect gaps. The client is a thin adapter between Excalidraw's `onChange` and `PUT elements`.

**Tech Stack:** Laravel 13, PHP 8.4, PostgreSQL, Pest 5, Reverb, Inertia 3 + React 19, Wayfinder, `@excalidraw/excalidraw` 0.18.1.

**Spec:** `docs/superpowers/specs/2026-10-01-whiteboard-design.md` — this plan covers R1–R4 and the "Blank" part of R5 (§6, §7, §8, the 17a rows of §12, §13). Read it before starting.

**Not in this plan:** templates and the gallery, duplicate, export tuning (17b); timer, board lock, follow-me, voting, facilitator hand-over dialog (17c); private writing, versions (17d); mid-drag drafts (spec §6.4 — Task 11 measures whether they are needed). A board created here is empty, which is the Blank template.

## Global Constraints

- The only new dependency is `@excalidraw/excalidraw`, pinned exactly (`0.18.1`). No other package, PHP or JS.
- Every primary and foreign key is a UUID (`tests/Feature/UuidPrimaryKeysTest.php` fails on an integer `id` or `*_id` column).
- Migrations have an `up` method only.
- Request bodies use snake_case keys; Excalidraw elements inside `elements` keep their camelCase keys.
- Route names are camelCase segments (`whiteboards.guestToken.store`); URLs are kebab-case; controllers are plural and stick to CRUD method names.
- Every user-facing string goes through `__()` (PHP) or `t()` (TS) and its key exists in `lang/en.json`, `lang/fr.json`, `lang/de.json`, `lang/es.json` (`tests/Feature/TranslationKeysTest.php`). Translations are in Appendix A.
- PHP style: early returns, no `else`, curly braces always, typed everything, no comments that restate code. Run `vendor/bin/pint --dirty --format agent` before every commit that touches PHP.
- Frontend: URLs only through Wayfinder (`@/actions/...`); run `npm run build` once after adding routes so the actions exist, then `npm run types:check` and `npm run check`.
- Tests: Pest feature tests with factories; run the narrowest file with `php artisan test --compact <path>`.
- Limits copied from the spec: 200 elements per request, 5 000 live elements per board, 64 KB per element, 10 000 characters of text, 5 MB per image, 100 MB of images per board, 8 KB broadcast payload, 20 writes per second.

## Review Focus

1. **The same batch arrives twice** (client retry after a timeout): the second copy must change nothing — no `seq` bump, no broadcast, no rejection the user sees. Pinned in Task 6.
2. **Two people release the same element with the same `version`**: both browsers must end on the same copy (lower `versionNonce` wins), and the loser gets the winner's copy back. Pinned in Task 6.
3. **One bad element in a batch** (non-array, unknown type, 70 KB stroke, `javascript:` link): the rest of the batch is saved and the request answers 200, never 500. Pinned in Tasks 5 and 6.
4. **Text with leading/trailing spaces or an empty string** must be stored byte-for-byte; Laravel's `TrimStrings` and `ConvertEmptyStringsToNull` would silently alter it. Pinned in Task 6.
5. **An image element whose file is missing or belongs to another board**: rejected, and a non-member can never download a file by guessing its id. Pinned in Task 7.

---

## File Structure

Backend (new unless marked):

| Path | Responsibility |
|---|---|
| `database/migrations/2026_10_09_100000_create_whiteboard_tables.php` | Four tables |
| `app/Models/Whiteboard.php`, `WhiteboardMember.php`, `WhiteboardElement.php`, `WhiteboardFile.php` | Models |
| `database/factories/Whiteboard*Factory.php` | Factories |
| `app/Models/Team.php` (modify) | `whiteboards()` relation |
| `app/Actions/Retros/GuestCookie.php` (modify) | `WhiteboardScope` |
| `app/Policies/TeamPolicy.php` (modify) | `createWhiteboard` |
| `app/Actions/Whiteboards/ResolveMember.php` | Request → member or null |
| `app/Http/Middleware/ResolveWhiteboardMember.php` | Gate for the board route group |
| `app/Actions/Whiteboards/WhiteboardGuard.php` | `facilitator`, `canDelete` |
| `app/Actions/Whiteboards/CreateWhiteboard.php` | Board + creator member + facilitator |
| `app/Actions/Whiteboards/PresentWhiteboardElement.php` | The only serializer of an element |
| `app/Actions/Whiteboards/BuildWhiteboardSnapshot.php` | Viewer-specific snapshot |
| `app/Actions/Whiteboards/PresentWhiteboardSummary.php` | Team page row |
| `app/Actions/Whiteboards/SanitizeWhiteboardElement.php` | Raw array → clean element or null |
| `app/Actions/Whiteboards/WriteWhiteboardElements.php` | The write rule of spec §6.3 |
| `app/Actions/Whiteboards/PurgeWhiteboardTombstones.php`, `PruneWhiteboardFiles.php` | Housekeeping |
| `app/Console/Commands/PruneWhiteboardsCommand.php` | `skrum:prune-whiteboards` |
| `app/Events/Whiteboards/*.php` | `WhiteboardBroadcastEvent`, `WhiteboardChanged`, `WhiteboardDeleted`, `WhiteboardElementsChanged` |
| `app/Http/Controllers/TeamWhiteboardsController.php` | `store` |
| `app/Http/Controllers/WhiteboardJoinsController.php` | Guest join |
| `app/Http/Controllers/Whiteboards/*.php` | `WhiteboardsController`, `WhiteboardSnapshotsController`, `WhiteboardSettingsController`, `WhiteboardGuestTokensController`, `WhiteboardFacilitatorsController`, `WhiteboardElementsController`, `WhiteboardFilesController` |
| `app/Http/Controllers/BroadcastAuthorizationsController.php` (modify) | `presence-whiteboard.` branch |
| `app/Http/Controllers/TeamsController.php` (modify) | `whiteboards`, `canCreateWhiteboard` props |
| `app/Providers/AppServiceProvider.php` (modify) | `whiteboard-writes` limiter |
| `routes/web.php`, `routes/console.php` (modify) | Routes, schedule |

Frontend (new unless marked):

| Path | Responsibility |
|---|---|
| `resources/js/lib/whiteboard/excalidraw.ts` | The single import point of the library |
| `resources/js/lib/whiteboard/types.ts` | Snapshot and wire types |
| `resources/js/lib/whiteboard/scene-sync.ts` | Queue, flush, reconcile, resync — no React |
| `resources/js/lib/whiteboard/files.ts` | Upload and download of images |
| `resources/js/hooks/use-whiteboard-channel.ts` | Presence channel and events |
| `resources/js/hooks/use-whiteboard.ts` | Board meta state, refetch, session end |
| `resources/js/hooks/use-whiteboard-cursors.ts` | Cursor whispers ↔ Excalidraw collaborators |
| `resources/js/components/whiteboard/board.tsx` | Canvas and wiring (the lazy chunk) |
| `resources/js/components/whiteboard/top-bar.tsx`, `board-menu.tsx`, `sticky-tool.tsx`, `board-gone.tsx` | UI around the canvas |
| `resources/js/pages/whiteboards/show.tsx`, `join.tsx` | Pages |
| `resources/js/components/teams/whiteboards-section.tsx`, `new-whiteboard-dialog.tsx` | Team page |
| `resources/js/pages/teams/show.tsx`, `resources/js/app.tsx`, `resources/js/types/index.ts` (modify) | Wiring |

---

### Task 1: Dependency spike

Proves that the pinned Excalidraw version offers the API the spec relies on, behind one adapter file. No product behaviour.

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `resources/js/lib/whiteboard/excalidraw.ts`
- Modify: `docs/superpowers/specs/2026-10-01-whiteboard-design.md` (§5 Dependencies, §18)

**Interfaces:**
- Produces: `@/lib/whiteboard/excalidraw` exporting `Excalidraw`, `CaptureUpdateAction`, `reconcileElements`, `restoreElements`, and the types `ExcalidrawImperativeAPI`, `ExcalidrawElement`, `AppState`, `BinaryFiles`, `BinaryFileData`, `Collaborator`, `SocketId`. Every later task imports the library only from this file.

- [ ] **Step 1: Install, pinned exactly**

Run: `npm install --save-exact @excalidraw/excalidraw@0.18.1`
Expected: `package.json` gains `"@excalidraw/excalidraw": "0.18.1"` (no caret), no peer-dependency warning for React 19.

- [ ] **Step 2: Write the adapter**

```ts
// resources/js/lib/whiteboard/excalidraw.ts
import '@excalidraw/excalidraw/index.css';

export {
    CaptureUpdateAction,
    Excalidraw,
    reconcileElements,
    restoreElements,
} from '@excalidraw/excalidraw';
export type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
export type {
    AppState,
    BinaryFileData,
    BinaryFiles,
    Collaborator,
    ExcalidrawImperativeAPI,
    SocketId,
} from '@excalidraw/excalidraw/types';
```

- [ ] **Step 3: Prove the API surface at compile time**

Append to the adapter a type-only check; it costs nothing at runtime and fails `tsc` if a member the spec relies on is missing:

```ts
import type { ExcalidrawImperativeAPI as Api } from '@excalidraw/excalidraw/types';
import type { ComponentProps } from 'react';
import type { Excalidraw as ExcalidrawComponent } from '@excalidraw/excalidraw';

type Props = ComponentProps<typeof ExcalidrawComponent>;

export type RequiredApi = Pick<
    Api,
    | 'updateScene'
    | 'getSceneElementsIncludingDeleted'
    | 'getAppState'
    | 'getFiles'
    | 'addFiles'
>;

export type RequiredProps = Pick<
    Props,
    | 'excalidrawAPI'
    | 'initialData'
    | 'onChange'
    | 'onPointerUpdate'
    | 'onScrollChange'
    | 'viewModeEnabled'
    | 'renderTopRightUI'
    | 'UIOptions'
    | 'langCode'
    | 'theme'
>;
```

Run: `npm run types:check`
Expected: PASS. If a name fails, find its replacement in `node_modules/@excalidraw/excalidraw/dist/types/excalidraw/` (`index.d.ts`, `types.d.ts`), fix the adapter only, and note the difference for Step 5.

- [ ] **Step 4: Check four facts by reading the installed types**

Open `node_modules/@excalidraw/excalidraw/dist/types/` and confirm, writing down each answer:

1. `reconcileElements(localElements, remoteElements, localAppState)` — argument order and return type.
2. `updateScene` accepts `{elements, appState, collaborators, captureUpdate}`.
3. The base element type has `id, version, versionNonce, isDeleted, locked, customData, link, index, frameId, boundElements, groupIds`. List any key of `ExcalidrawElement` and its text, linear, freedraw, image and frame variants that is **not** in the key lists of Task 5; Task 5 must add them.
4. How to hide the library button and "Open" (`UIOptions.canvasActions.loadScene`, and whether a `UIOptions` key or only CSS hides the library trigger).

- [ ] **Step 5: Record the result in the spec**

In spec §5 "Dependencies", replace the sentence starting "The exact version is pinned by the first task of plan 17a" with: "Pinned to `0.18.1` (React 19 listed in its peer dependencies). The spike of plan 17a confirmed the API listed here" followed by any renamed member found in Steps 3–4. In §18 remove the first open question.

- [ ] **Step 6: Commit**

```bash
npm run check
git add package.json package-lock.json resources/js/lib/whiteboard/excalidraw.ts docs/superpowers/specs/2026-10-01-whiteboard-design.md
git commit -m "chore(whiteboard): pin excalidraw and prove the api the spec relies on"
```

---

### Task 2: Tables, models, factories

**Files:**
- Create: `database/migrations/2026_10_09_100000_create_whiteboard_tables.php`
- Create: `app/Models/Whiteboard.php`, `app/Models/WhiteboardMember.php`, `app/Models/WhiteboardElement.php`, `app/Models/WhiteboardFile.php`
- Create: `database/factories/WhiteboardFactory.php`, `WhiteboardMemberFactory.php`, `WhiteboardElementFactory.php`, `WhiteboardFileFactory.php`
- Modify: `app/Models/Team.php`, `app/Actions/Retros/GuestCookie.php`, `tests/Pest.php`
- Test: `tests/Feature/Whiteboards/WhiteboardModelTest.php`

**Interfaces:**
- Produces:
  - `Whiteboard` — `team()`, `members()`, `elements()`, `files()`, `facilitator()`, `isFacilitator(WhiteboardMember): bool`, const `MaxLiveElements = 5000`, `storageDirectory(): string`.
  - `WhiteboardMember::current(Request): self` (reads request attribute `whiteboardMember`), `HasGuestIdentity` methods.
  - `GuestCookie::WhiteboardScope = 'whiteboard'`.
  - `Team::whiteboards(): HasMany`.
  - Pest helpers: `whiteboardMember(Whiteboard): array{0: User, 1: WhiteboardMember}`, `whiteboardFacilitator(Whiteboard): array{0: User, 1: WhiteboardMember}`, `whiteboardGuest(Whiteboard, string $secret = 'secret'): WhiteboardMember`, `whiteboardGuestCookie(WhiteboardMember, string $secret = 'secret'): array`, `sceneElement(array $overrides = []): array`.

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Whiteboards/WhiteboardModelTest.php

use App\Actions\Retros\GuestCookie;
use App\Models\Team;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;
use App\Models\WhiteboardMember;
use Illuminate\Database\QueryException;
use Illuminate\Support\Str;

it('creates a board with uuid keys and safe defaults', function () {
    $board = Whiteboard::factory()->create()->fresh();

    expect(Str::isUuid($board->id))->toBeTrue()
        ->and($board->guest_access_enabled)->toBeFalse()
        ->and($board->cursors_enabled)->toBeTrue()
        ->and($board->seq)->toBe(0)
        ->and($board->purged_seq)->toBe(0)
        ->and($board->toArray())->not->toHaveKey('guest_token');
});

it('relates boards to teams, members, elements and files', function () {
    $team = Team::factory()->create();
    $board = Whiteboard::factory()->create(['team_id' => $team->id]);
    [, $member] = whiteboardFacilitator($board);
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'author_member_id' => $member->id]);
    WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);

    expect($team->whiteboards()->count())->toBe(1)
        ->and($board->fresh()->isFacilitator($member))->toBeTrue()
        ->and($board->members()->count())->toBe(1)
        ->and($board->elements()->count())->toBe(1)
        ->and($board->files()->count())->toBe(1);
});

it('keeps one row per element id on a board', function () {
    $board = Whiteboard::factory()->create();
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'abc']);

    expect(fn () => WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'abc']))
        ->toThrow(QueryException::class);
});

it('gives guests an identity and a board-scoped cookie', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    $guest = whiteboardGuest($board);

    expect($guest->isGuest())->toBeTrue()
        ->and($guest->toArray())->not->toHaveKey('guest_secret_hash')
        ->and(GuestCookie::name(GuestCookie::WhiteboardScope, $board->id))->toBe("whiteboard_guest_{$board->id}")
        ->and(whiteboardGuestCookie($guest))->toBe(["whiteboard_guest_{$board->id}" => "{$guest->id}|secret"]);
});

it('clears the facilitator when their member row goes', function () {
    $board = Whiteboard::factory()->create();
    [, $member] = whiteboardFacilitator($board);

    WhiteboardMember::query()->whereKey($member->id)->delete();

    expect($board->fresh()->facilitator_member_id)->toBeNull();
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `php artisan test --compact tests/Feature/Whiteboards/WhiteboardModelTest.php`
Expected: FAIL — `Class "App\Models\Whiteboard" not found`.

- [ ] **Step 3: Write the migration**

Run: `php artisan make:migration create_whiteboard_tables --no-interaction`, rename the file to `2026_10_09_100000_create_whiteboard_tables.php`, and replace its body:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('whiteboards', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->string('title', 120);
            $table->uuid('facilitator_member_id')->nullable();
            $table->boolean('guest_access_enabled')->default(false);
            $table->string('guest_token', 40)->unique();
            $table->boolean('cursors_enabled')->default(true);
            $table->unsignedBigInteger('seq')->default(0);
            $table->unsignedBigInteger('purged_seq')->default(0);
            $table->timestamps();

            $table->index(['team_id', 'updated_at']);
        });

        Schema::create('whiteboard_members', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('whiteboard_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('guest_name', 50)->nullable();
            $table->string('guest_secret_hash', 64)->nullable();
            $table->timestamps();

            $table->unique(['whiteboard_id', 'user_id']);
        });

        Schema::table('whiteboards', function (Blueprint $table) {
            $table->foreign('facilitator_member_id')->references('id')->on('whiteboard_members')->nullOnDelete();
        });

        Schema::create('whiteboard_elements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('whiteboard_id')->constrained()->cascadeOnDelete();
            $table->string('element_id', 40);
            $table->string('type', 20);
            $table->json('data');
            $table->unsignedInteger('version');
            $table->unsignedBigInteger('version_nonce');
            $table->foreignUuid('author_member_id')->nullable()->constrained('whiteboard_members')->nullOnDelete();
            $table->boolean('is_sticky')->default(false);
            $table->boolean('is_deleted')->default(false);
            $table->unsignedBigInteger('seq');
            $table->timestamps();

            $table->unique(['whiteboard_id', 'element_id']);
            $table->index(['whiteboard_id', 'seq']);
        });

        Schema::create('whiteboard_files', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('whiteboard_id')->constrained()->cascadeOnDelete();
            $table->string('file_id', 64);
            $table->string('path');
            $table->string('mime_type', 40);
            $table->unsignedInteger('size');
            $table->foreignUuid('uploaded_by_member_id')->nullable()->constrained('whiteboard_members')->nullOnDelete();
            $table->timestamps();

            $table->unique(['whiteboard_id', 'file_id']);
        });
    }
};
```

`purged_seq` is the highest `seq` among purged tombstones; `GET elements?since=` answers 409 below it (spec §6.3).

- [ ] **Step 4: Write the models**

```php
<?php
// app/Models/Whiteboard.php

namespace App\Models;

use Database\Factories\WhiteboardFactory;
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
 * @property string|null $facilitator_member_id
 * @property bool $guest_access_enabled
 * @property string $guest_token
 * @property bool $cursors_enabled
 * @property int $seq
 * @property int $purged_seq
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Team $team
 */
#[Fillable(['title', 'facilitator_member_id', 'guest_access_enabled', 'guest_token', 'cursors_enabled', 'seq', 'purged_seq'])]
#[Hidden(['guest_token'])]
class Whiteboard extends Model
{
    /** @use HasFactory<WhiteboardFactory> */
    use HasFactory;

    use HasUuids;

    public const MaxLiveElements = 5000;

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /** @return HasMany<WhiteboardMember, $this> */
    public function members(): HasMany
    {
        return $this->hasMany(WhiteboardMember::class)->orderBy('created_at')->orderBy('id');
    }

    /** @return HasMany<WhiteboardElement, $this> */
    public function elements(): HasMany
    {
        return $this->hasMany(WhiteboardElement::class);
    }

    /** @return HasMany<WhiteboardFile, $this> */
    public function files(): HasMany
    {
        return $this->hasMany(WhiteboardFile::class);
    }

    /** @return BelongsTo<WhiteboardMember, $this> */
    public function facilitator(): BelongsTo
    {
        return $this->belongsTo(WhiteboardMember::class, 'facilitator_member_id');
    }

    public function isFacilitator(WhiteboardMember $member): bool
    {
        return $this->facilitator_member_id === $member->id;
    }

    public function storageDirectory(): string
    {
        return "whiteboards/{$this->id}";
    }

    protected function casts(): array
    {
        return [
            'guest_access_enabled' => 'boolean',
            'cursors_enabled' => 'boolean',
            'seq' => 'integer',
            'purged_seq' => 'integer',
        ];
    }
}
```

```php
<?php
// app/Models/WhiteboardMember.php

namespace App\Models;

use App\Concerns\HasGuestIdentity;
use Database\Factories\WhiteboardMemberFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $whiteboard_id
 * @property string|null $user_id
 * @property string|null $guest_name
 * @property string|null $guest_secret_hash
 * @property Carbon|null $created_at
 * @property-read Whiteboard $whiteboard
 * @property-read User|null $user
 */
#[Fillable(['whiteboard_id', 'user_id', 'guest_name', 'guest_secret_hash'])]
#[Hidden(['guest_secret_hash'])]
class WhiteboardMember extends Model
{
    /** @use HasFactory<WhiteboardMemberFactory> */
    use HasFactory;

    use HasGuestIdentity;
    use HasUuids;

    public static function current(Request $request): self
    {
        $member = $request->attributes->get('whiteboardMember');

        abort_unless($member instanceof self, 403);

        return $member;
    }

    /** @return BelongsTo<Whiteboard, $this> */
    public function whiteboard(): BelongsTo
    {
        return $this->belongsTo(Whiteboard::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
```

```php
<?php
// app/Models/WhiteboardElement.php

namespace App\Models;

use Database\Factories\WhiteboardElementFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $whiteboard_id
 * @property string $element_id
 * @property string $type
 * @property array<string, mixed> $data
 * @property int $version
 * @property int $version_nonce
 * @property string|null $author_member_id
 * @property bool $is_sticky
 * @property bool $is_deleted
 * @property int $seq
 */
#[Fillable(['whiteboard_id', 'element_id', 'type', 'data', 'version', 'version_nonce', 'author_member_id', 'is_sticky', 'is_deleted', 'seq'])]
class WhiteboardElement extends Model
{
    /** @use HasFactory<WhiteboardElementFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Whiteboard, $this> */
    public function whiteboard(): BelongsTo
    {
        return $this->belongsTo(Whiteboard::class);
    }

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'version' => 'integer',
            'version_nonce' => 'integer',
            'is_sticky' => 'boolean',
            'is_deleted' => 'boolean',
            'seq' => 'integer',
        ];
    }
}
```

```php
<?php
// app/Models/WhiteboardFile.php

namespace App\Models;

use Database\Factories\WhiteboardFileFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $whiteboard_id
 * @property string $file_id
 * @property string $path
 * @property string $mime_type
 * @property int $size
 * @property string|null $uploaded_by_member_id
 */
#[Fillable(['whiteboard_id', 'file_id', 'path', 'mime_type', 'size', 'uploaded_by_member_id'])]
class WhiteboardFile extends Model
{
    /** @use HasFactory<WhiteboardFileFactory> */
    use HasFactory;

    use HasUuids;

    protected function casts(): array
    {
        return ['size' => 'integer'];
    }
}
```

In `app/Models/Team.php`, after `pokerGames()`:

```php
    /** @return HasMany<Whiteboard, $this> */
    public function whiteboards(): HasMany
    {
        return $this->hasMany(Whiteboard::class);
    }
```

In `app/Actions/Retros/GuestCookie.php`, after `GameScope`:

```php
    public const WhiteboardScope = 'whiteboard';
```

- [ ] **Step 5: Write the factories**

```php
<?php
// database/factories/WhiteboardFactory.php

namespace Database\Factories;

use App\Models\Team;
use App\Models\Whiteboard;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Whiteboard>
 */
class WhiteboardFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'title' => fake()->sentence(3),
            'guest_token' => Str::random(40),
        ];
    }

    public function withGuestAccess(): static
    {
        return $this->state(fn () => ['guest_access_enabled' => true]);
    }
}
```

```php
<?php
// database/factories/WhiteboardMemberFactory.php

namespace Database\Factories;

use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WhiteboardMember>
 */
class WhiteboardMemberFactory extends Factory
{
    public function definition(): array
    {
        return [
            'whiteboard_id' => Whiteboard::factory(),
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
}
```

```php
<?php
// database/factories/WhiteboardElementFactory.php

namespace Database\Factories;

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<WhiteboardElement>
 */
class WhiteboardElementFactory extends Factory
{
    public function definition(): array
    {
        return [
            'whiteboard_id' => Whiteboard::factory(),
            'element_id' => Str::random(20),
            'type' => 'rectangle',
            'data' => fn (array $attributes) => self::rectangle($attributes['element_id']),
            'version' => 1,
            'version_nonce' => 1,
            'seq' => 1,
        ];
    }

    public function deleted(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_deleted' => true,
            'data' => [...self::rectangle($attributes['element_id']), 'isDeleted' => true],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private static function rectangle(string $elementId): array
    {
        return [
            'id' => $elementId,
            'type' => 'rectangle',
            'x' => 0,
            'y' => 0,
            'width' => 100,
            'height' => 50,
            'version' => 1,
            'versionNonce' => 1,
            'isDeleted' => false,
            'locked' => false,
        ];
    }
}
```

```php
<?php
// database/factories/WhiteboardFileFactory.php

namespace Database\Factories;

use App\Models\Whiteboard;
use App\Models\WhiteboardFile;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WhiteboardFile>
 */
class WhiteboardFileFactory extends Factory
{
    public function definition(): array
    {
        return [
            'whiteboard_id' => Whiteboard::factory(),
            'file_id' => sha1(fake()->uuid()),
            'path' => fn (array $attributes) => "whiteboards/{$attributes['whiteboard_id']}/{$attributes['file_id']}",
            'mime_type' => 'image/png',
            'size' => 1024,
        ];
    }
}
```

- [ ] **Step 6: Add the Pest helpers**

In `tests/Pest.php`, add `use App\Models\Whiteboard;` and `use App\Models\WhiteboardMember;` to the imports and append:

```php
/**
 * @return array{0: User, 1: WhiteboardMember}
 */
function whiteboardMember(Whiteboard $board): array
{
    $user = teamMember($board->team);

    return [$user, WhiteboardMember::factory()->create(['whiteboard_id' => $board->id, 'user_id' => $user->id])];
}

/**
 * @return array{0: User, 1: WhiteboardMember}
 */
function whiteboardFacilitator(Whiteboard $board): array
{
    [$user, $member] = whiteboardMember($board);

    $board->update(['facilitator_member_id' => $member->id]);

    return [$user, $member];
}

function whiteboardGuest(Whiteboard $board, string $secret = 'secret'): WhiteboardMember
{
    return WhiteboardMember::factory()->guest($secret)->create(['whiteboard_id' => $board->id]);
}

/**
 * @return array<string, string>
 */
function whiteboardGuestCookie(WhiteboardMember $member, string $secret = 'secret'): array
{
    return [GuestCookie::name(GuestCookie::WhiteboardScope, $member->whiteboard_id) => "{$member->id}|{$secret}"];
}

/**
 * A rectangle as Excalidraw sends it.
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function sceneElement(array $overrides = []): array
{
    return [
        'id' => Str::random(20),
        'type' => 'rectangle',
        'x' => 10,
        'y' => 20,
        'width' => 100,
        'height' => 50,
        'angle' => 0,
        'strokeColor' => '#1e1e1e',
        'backgroundColor' => 'transparent',
        'fillStyle' => 'solid',
        'strokeWidth' => 2,
        'strokeStyle' => 'solid',
        'roughness' => 1,
        'opacity' => 100,
        'groupIds' => [],
        'frameId' => null,
        'index' => 'a0',
        'roundness' => null,
        'seed' => 1,
        'version' => 1,
        'versionNonce' => 100,
        'isDeleted' => false,
        'boundElements' => null,
        'updated' => 1,
        'link' => null,
        'locked' => false,
        ...$overrides,
    ];
}
```

- [ ] **Step 7: Run the tests**

Run: `php artisan test --compact tests/Feature/Whiteboards/WhiteboardModelTest.php tests/Feature/UuidPrimaryKeysTest.php`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add database app/Models app/Actions/Retros/GuestCookie.php tests
git commit -m "feat(whiteboard): add the whiteboard tables, models and factories"
```

---

### Task 3: Create, enter, snapshot, delete

**Files:**
- Modify: `app/Policies/TeamPolicy.php`, `routes/web.php`
- Create: `app/Actions/Whiteboards/ResolveMember.php`, `WhiteboardGuard.php`, `CreateWhiteboard.php`, `PresentWhiteboardElement.php`, `BuildWhiteboardSnapshot.php`
- Create: `app/Http/Middleware/ResolveWhiteboardMember.php`
- Create: `app/Events/Whiteboards/WhiteboardBroadcastEvent.php`, `WhiteboardChanged.php`, `WhiteboardDeleted.php`
- Create: `app/Http/Controllers/TeamWhiteboardsController.php`, `app/Http/Controllers/Whiteboards/WhiteboardsController.php`, `WhiteboardSnapshotsController.php`
- Create: `resources/js/pages/whiteboards/show.tsx` (placeholder, replaced in Task 9)
- Test: `tests/Feature/Whiteboards/CreateWhiteboardTest.php`, `WhiteboardAccessTest.php`, `WhiteboardSnapshotTest.php`, `WhiteboardEventsTest.php`

**Interfaces:**
- Consumes: Task 2 models and helpers.
- Produces:
  - `ResolveMember::handle(Request, Whiteboard): ?WhiteboardMember`
  - `WhiteboardGuard::facilitator(Whiteboard, WhiteboardMember): void`, `WhiteboardGuard::canDelete(Whiteboard, WhiteboardMember): void` (both throw `AuthorizationException`)
  - `CreateWhiteboard::handle(Team, User, string $title): Whiteboard`
  - `PresentWhiteboardElement::handle(WhiteboardElement, WhiteboardMember $viewer): array<string, mixed>`
  - `BuildWhiteboardSnapshot::handle(Whiteboard, WhiteboardMember $viewer): array` with keys `board, me, members, elements, seq, links, serverTime`
  - Events `WhiteboardChanged(string $boardId)` → `board.changed` `{}`, `WhiteboardDeleted(string $boardId)` → `board.deleted` `{}`, on `presence-whiteboard.{id}`, each with `sendToOthers()`
  - Routes `teams.whiteboards.store`, `whiteboards.show`, `whiteboards.destroy`, `whiteboards.snapshot.show`; route parameter `{board}`

- [ ] **Step 1: Write the failing tests**

```php
<?php
// tests/Feature/Whiteboards/CreateWhiteboardTest.php

use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;

it('creates a board and makes the creator its facilitator', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $response = $this->actingAs($user)
        ->post(route('teams.whiteboards.store', [$team->workspace, $team]), ['title' => 'Discovery']);

    $board = Whiteboard::query()->sole();

    $response->assertRedirect(route('whiteboards.show', $board));

    expect($board->title)->toBe('Discovery')
        ->and($board->team_id)->toBe($team->id)
        ->and(strlen($board->guest_token))->toBe(40)
        ->and($board->facilitator?->user_id)->toBe($user->id)
        ->and($board->elements()->count())->toBe(0);
});

it('requires a title of at most 120 characters', function (string $title) {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->post(route('teams.whiteboards.store', [$team->workspace, $team]), ['title' => $title])
        ->assertSessionHasErrors('title');

    expect(Whiteboard::query()->count())->toBe(0);
})->with(['empty' => '', 'too long' => str_repeat('a', 121)]);

it('refuses people who cannot view the team', function () {
    $team = Team::factory()->create();
    $outsider = User::factory()->create();
    $team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)
        ->post(route('teams.whiteboards.store', [$team->workspace, $team]), ['title' => 'Nope'])
        ->assertForbidden();
});
```

```php
<?php
// tests/Feature/Whiteboards/WhiteboardAccessTest.php

use App\Enums\WorkspaceRole;
use App\Events\Whiteboards\WhiteboardDeleted;
use App\Models\User;
use App\Models\Whiteboard;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;

it('lets team members in as themselves', function () {
    $board = Whiteboard::factory()->create();
    $user = teamMember($board->team);

    $this->actingAs($user)
        ->get(route('whiteboards.show', $board))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('whiteboards/show')
            ->where('snapshot.board.id', $board->id)
            ->where('snapshot.me.isGuest', false));

    $this->actingAs($user)->getJson(route('whiteboards.snapshot.show', $board))->assertOk();

    expect($board->members()->where('user_id', $user->id)->count())->toBe(1);
});

it('lets workspace managers open any team board', function () {
    $board = Whiteboard::factory()->create();

    $this->actingAs(workspaceManager($board->team->workspace))
        ->get(route('whiteboards.show', $board))
        ->assertOk();
});

it('lets a guest with a valid cookie in while guest access is on', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    $guest = whiteboardGuest($board);

    $this->withUnencryptedCookies(whiteboardGuestCookie($guest))
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertOk()
        ->assertJsonPath('me.id', $guest->id)
        ->assertJsonPath('me.isGuest', true);
});

it('refuses guests once guest access is off or the secret is wrong', function () {
    $board = Whiteboard::factory()->create();
    $guest = whiteboardGuest($board);

    $this->withUnencryptedCookies(whiteboardGuestCookie($guest))
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertForbidden();

    $board->update(['guest_access_enabled' => true]);

    $this->withUnencryptedCookies(whiteboardGuestCookie($guest, 'wrong'))
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertForbidden();
});

it('sends logged-out visitors to login', function () {
    $this->get(route('whiteboards.show', Whiteboard::factory()->create()))->assertRedirect(route('login'));
});

it('shows the session-ended page for guest-enabled boards', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();

    $this->get(route('whiteboards.show', $board))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('retros/session-ended'))
        ->assertSessionHas('url.intended', route('whiteboards.show', $board));
});

it('refuses non-members with 403', function () {
    $board = Whiteboard::factory()->create();
    $outsider = User::factory()->create();
    $board->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)->get(route('whiteboards.show', $board))->assertForbidden();
    $this->actingAs($outsider)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertForbidden()
        ->assertJsonPath('message', 'You no longer have access to this board.');

    expect($board->members()->count())->toBe(0);
});

it('answers logged-out json requests with 401', function () {
    $this->getJson(route('whiteboards.snapshot.show', Whiteboard::factory()->create()))
        ->assertUnauthorized()
        ->assertJsonPath('message', 'Your session has expired.');
});

it('lets the facilitator or a workspace admin delete the board', function () {
    Event::fake([WhiteboardDeleted::class]);

    $board = Whiteboard::factory()->create();
    [$facilitator] = whiteboardFacilitator($board);
    [$member] = whiteboardMember($board);

    $this->actingAs($member)->deleteJson(route('whiteboards.destroy', $board))
        ->assertForbidden()
        ->assertJsonPath('message', 'Only the facilitator or a workspace admin can delete this board.');

    $this->actingAs($facilitator)->deleteJson(route('whiteboards.destroy', $board))->assertNoContent();

    expect(Whiteboard::query()->count())->toBe(0);
    Event::assertDispatched(WhiteboardDeleted::class, fn (WhiteboardDeleted $event) => $event->boardId === $board->id);

    $other = Whiteboard::factory()->create();

    $this->actingAs(workspaceManager($other->team->workspace))
        ->deleteJson(route('whiteboards.destroy', $other))
        ->assertNoContent();
});
```

```php
<?php
// tests/Feature/Whiteboards/WhiteboardSnapshotTest.php

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;

it('describes the board, the viewer, the members and the live elements', function () {
    $board = Whiteboard::factory()->create(['title' => 'Map', 'seq' => 7]);
    [$user, $member] = whiteboardFacilitator($board);
    $live = WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'seq' => 3]);
    WhiteboardElement::factory()->deleted()->create(['whiteboard_id' => $board->id, 'seq' => 7]);

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertOk()
        ->assertJsonPath('board.title', 'Map')
        ->assertJsonPath('board.facilitatorMemberId', $member->id)
        ->assertJsonPath('board.guestUrl', route('whiteboards.join.show', $board->guest_token))
        ->assertJsonPath('board.cursorsEnabled', true)
        ->assertJsonPath('me.id', $member->id)
        ->assertJsonPath('me.userId', $user->id)
        ->assertJsonPath('me.isFacilitator', true)
        ->assertJsonPath('me.canDelete', true)
        ->assertJsonPath('me.canTakeControl', false)
        ->assertJsonCount(1, 'members')
        ->assertJsonCount(1, 'elements')
        ->assertJsonPath('elements.0.id', $live->element_id)
        ->assertJsonPath('seq', 7)
        ->assertJsonPath('links.team', route('teams.show', [$board->team->workspace, $board->team], absolute: false));
});

it('lets a non-facilitating member take control but not delete', function () {
    $board = Whiteboard::factory()->create();
    whiteboardFacilitator($board);
    [$user] = whiteboardMember($board);

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('me.isFacilitator', false)
        ->assertJsonPath('me.canTakeControl', true)
        ->assertJsonPath('me.canDelete', false);
});

it('hides the guest link, the team link and the token from guests', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    $guest = whiteboardGuest($board);

    $response = $this->withUnencryptedCookies(whiteboardGuestCookie($guest))
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertOk()
        ->assertJsonPath('board.guestUrl', null)
        ->assertJsonPath('links.team', null)
        ->assertJsonPath('me.canTakeControl', false);

    expect($response->getContent())->not->toContain($board->guest_token);
});
```

```php
<?php
// tests/Feature/Whiteboards/WhiteboardEventsTest.php

use App\Events\Whiteboards\WhiteboardBroadcastEvent;
use App\Events\Whiteboards\WhiteboardChanged;
use App\Events\Whiteboards\WhiteboardDeleted;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;

it('broadcasts on the whiteboard presence channel', function () {
    $event = new WhiteboardChanged('board-id');

    expect($event)->toBeInstanceOf(ShouldBroadcastNow::class)
        ->and($event)->toBeInstanceOf(ShouldDispatchAfterCommit::class)
        ->and($event->broadcastOn())->toBeInstanceOf(PresenceChannel::class)
        ->and($event->broadcastOn()->name)->toBe('presence-whiteboard.board-id');
});

it('names its events and keeps their payloads empty', function (WhiteboardBroadcastEvent $event, string $name) {
    expect($event->broadcastAs())->toBe($name)
        ->and($event->broadcastWith())->toBe([]);
})->with([
    'board changed' => [fn () => new WhiteboardChanged('b'), 'board.changed'],
    'board deleted' => [fn () => new WhiteboardDeleted('b'), 'board.deleted'],
]);
```

- [ ] **Step 2: Run them to see them fail**

Run: `php artisan test --compact tests/Feature/Whiteboards`
Expected: FAIL — route `teams.whiteboards.store` not defined.

- [ ] **Step 3: Policy, resolver, middleware, guard**

In `app/Policies/TeamPolicy.php`, after `createPokerGame`:

```php
    public function createWhiteboard(User $user, Team $team): bool
    {
        return $this->view($user, $team);
    }
```

```php
<?php
// app/Actions/Whiteboards/ResolveMember.php

namespace App\Actions\Whiteboards;

use App\Actions\Retros\GuestCookie;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use Illuminate\Http\Request;

class ResolveMember
{
    public function handle(Request $request, Whiteboard $board): ?WhiteboardMember
    {
        $user = $request->user();

        if ($user !== null && $user->can('view', $board->team)) {
            return WhiteboardMember::query()->firstOrCreate([
                'whiteboard_id' => $board->id,
                'user_id' => $user->id,
            ]);
        }

        return $this->guest($request, $board);
    }

    private function guest(Request $request, Whiteboard $board): ?WhiteboardMember
    {
        if (! $board->guest_access_enabled) {
            return null;
        }

        $credentials = GuestCookie::parse($request->cookie(GuestCookie::name(GuestCookie::WhiteboardScope, $board->id)));

        if ($credentials === null) {
            return null;
        }

        [$memberId, $secret] = $credentials;

        $member = $board->members()
            ->whereKey($memberId)
            ->whereNull('user_id')
            ->whereNotNull('guest_secret_hash')
            ->first();

        if ($member === null) {
            return null;
        }

        if (! hash_equals((string) $member->guest_secret_hash, hash('sha256', $secret))) {
            return null;
        }

        return $member;
    }
}
```

```php
<?php
// app/Http/Middleware/ResolveWhiteboardMember.php

namespace App\Http\Middleware;

use App\Actions\Retros\GuestCookie;
use App\Actions\Whiteboards\ResolveMember;
use App\Models\Whiteboard;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class ResolveWhiteboardMember
{
    public function __construct(private ResolveMember $resolveMember) {}

    public function handle(Request $request, Closure $next): Response
    {
        $board = $request->route('board');

        abort_unless($board instanceof Whiteboard, 404);

        $member = $this->resolveMember->handle($request, $board);

        if ($member === null && $request->user() === null && ! $request->expectsJson()) {
            return $this->sendToLogin($request, $board);
        }

        if ($member === null) {
            $hasGuestCookie = $request->cookies->has(GuestCookie::name(GuestCookie::WhiteboardScope, $board->id));

            abort_if($request->user() === null && ! $hasGuestCookie, 401, __('Your session has expired.'));

            abort(403, __('You no longer have access to this board.'));
        }

        $request->attributes->set('whiteboardMember', $member);

        return $next($request);
    }

    /**
     * Once the guest cookie is gone, an expired guest cannot be told apart
     * from a logged-out member, so guest-enabled boards explain both ways back.
     */
    private function sendToLogin(Request $request, Whiteboard $board): Response
    {
        if (! $board->guest_access_enabled) {
            return redirect()->guest(route('login'));
        }

        redirect()->setIntendedUrl($request->fullUrl());

        return Inertia::render('retros/session-ended')->toResponse($request);
    }
}
```

```php
<?php
// app/Actions/Whiteboards/WhiteboardGuard.php

namespace App\Actions\Whiteboards;

use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use Illuminate\Auth\Access\AuthorizationException;

class WhiteboardGuard
{
    public static function facilitator(Whiteboard $board, WhiteboardMember $member): void
    {
        if ($board->isFacilitator($member)) {
            return;
        }

        throw new AuthorizationException(__('Only the facilitator can do this.'));
    }

    public static function canDelete(Whiteboard $board, WhiteboardMember $member): void
    {
        if ($board->isFacilitator($member)) {
            return;
        }

        if ($member->user?->canManage($board->team->workspace)) {
            return;
        }

        throw new AuthorizationException(__('Only the facilitator or a workspace admin can delete this board.'));
    }
}
```

- [ ] **Step 4: Events**

```php
<?php
// app/Events/Whiteboards/WhiteboardBroadcastEvent.php

namespace App\Events\Whiteboards;

use App\Events\Concerns\SendsToOthers;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

abstract class WhiteboardBroadcastEvent implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable;
    use InteractsWithSockets;
    use SendsToOthers;

    public function __construct(public string $boardId) {}

    public function broadcastOn(): Channel
    {
        return new PresenceChannel("whiteboard.{$this->boardId}");
    }

    abstract public function broadcastAs(): string;

    /**
     * @return array<string, mixed>
     */
    abstract public function broadcastWith(): array;
}
```

```php
<?php
// app/Events/Whiteboards/WhiteboardChanged.php

namespace App\Events\Whiteboards;

class WhiteboardChanged extends WhiteboardBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'board.changed';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
```

```php
<?php
// app/Events/Whiteboards/WhiteboardDeleted.php

namespace App\Events\Whiteboards;

class WhiteboardDeleted extends WhiteboardBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'board.deleted';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
```

- [ ] **Step 5: Actions**

```php
<?php
// app/Actions/Whiteboards/CreateWhiteboard.php

namespace App\Actions\Whiteboards;

use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreateWhiteboard
{
    public function handle(Team $team, User $creator, string $title): Whiteboard
    {
        return DB::transaction(function () use ($team, $creator, $title): Whiteboard {
            $board = $team->whiteboards()->create([
                'title' => $title,
                'guest_token' => Str::random(40),
            ]);

            $member = $board->members()->create(['user_id' => $creator->id]);

            $board->update(['facilitator_member_id' => $member->id]);

            return $board;
        });
    }
}
```

```php
<?php
// app/Actions/Whiteboards/PresentWhiteboardElement.php

namespace App\Actions\Whiteboards;

use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;

/**
 * The only place an element is turned into a payload. It takes the viewer
 * because private writing (spec §11.5) masks an element per viewer here.
 */
class PresentWhiteboardElement
{
    /**
     * @return array<string, mixed>
     */
    public function handle(WhiteboardElement $element, WhiteboardMember $viewer): array
    {
        return $element->data;
    }
}
```

```php
<?php
// app/Actions/Whiteboards/BuildWhiteboardSnapshot.php

namespace App\Actions\Whiteboards;

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;

/**
 * @phpstan-type Snapshot array{
 *     board: array{
 *         id: string,
 *         title: string,
 *         teamId: string,
 *         facilitatorMemberId: ?string,
 *         guestAccessEnabled: bool,
 *         guestUrl: ?string,
 *         cursorsEnabled: bool
 *     },
 *     me: array{
 *         id: string,
 *         userId: ?string,
 *         name: string,
 *         avatarUrl: string,
 *         isGuest: bool,
 *         isFacilitator: bool,
 *         canTakeControl: bool,
 *         canDelete: bool
 *     },
 *     members: array<int, array{id: string, name: string, avatarUrl: string, isGuest: bool}>,
 *     elements: array<int, array<string, mixed>>,
 *     seq: int,
 *     links: array{team: ?string},
 *     serverTime: string
 * }
 */
class BuildWhiteboardSnapshot
{
    public function __construct(private PresentWhiteboardElement $presentWhiteboardElement) {}

    /**
     * @return Snapshot
     */
    public function handle(Whiteboard $board, WhiteboardMember $viewer): array
    {
        $board->load(['team.workspace', 'members.user']);
        $viewer->loadMissing('user');

        $isGuest = $viewer->isGuest();
        $isFacilitator = $board->isFacilitator($viewer);
        $isManager = (bool) $viewer->user?->canManage($board->team->workspace);

        return [
            'board' => [
                'id' => $board->id,
                'title' => $board->title,
                'teamId' => $board->team_id,
                'facilitatorMemberId' => $board->facilitator_member_id,
                'guestAccessEnabled' => $board->guest_access_enabled,
                'guestUrl' => $isGuest ? null : route('whiteboards.join.show', $board->guest_token),
                'cursorsEnabled' => $board->cursors_enabled,
            ],
            'me' => [
                'id' => $viewer->id,
                'userId' => $viewer->user_id,
                'name' => $viewer->displayName(),
                'avatarUrl' => $viewer->avatarUrl(),
                'isGuest' => $isGuest,
                'isFacilitator' => $isFacilitator,
                'canTakeControl' => ! $isGuest && ! $isFacilitator,
                'canDelete' => $isFacilitator || $isManager,
            ],
            'members' => $board->members
                ->map(fn (WhiteboardMember $member): array => [
                    'id' => $member->id,
                    'name' => $member->displayName(),
                    'avatarUrl' => $member->avatarUrl(),
                    'isGuest' => $member->isGuest(),
                ])
                ->values()
                ->all(),
            'elements' => $board->elements()
                ->where('is_deleted', false)
                ->orderBy('seq')
                ->get()
                ->map(fn (WhiteboardElement $element): array => $this->presentWhiteboardElement->handle($element, $viewer))
                ->all(),
            'seq' => $board->seq,
            'links' => [
                'team' => $isGuest ? null : route('teams.show', [$board->team->workspace, $board->team], absolute: false),
            ],
            'serverTime' => now()->toIso8601String(),
        ];
    }
}
```

`route('whiteboards.join.show', …)` is registered in this task's routes (Step 7) and implemented in Task 4; registering the route name now keeps the snapshot test green.

- [ ] **Step 6: Controllers**

```php
<?php
// app/Http/Controllers/TeamWhiteboardsController.php

namespace App\Http\Controllers;

use App\Actions\Whiteboards\CreateWhiteboard;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TeamWhiteboardsController extends Controller
{
    public function store(Request $request, Workspace $workspace, Team $team, CreateWhiteboard $createWhiteboard): RedirectResponse
    {
        Gate::authorize('createWhiteboard', $team);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
        ]);

        $board = $createWhiteboard->handle($team, $request->user(), $validated['title']);

        return to_route('whiteboards.show', $board);
    }
}
```

```php
<?php
// app/Http/Controllers/Whiteboards/WhiteboardsController.php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\BuildWhiteboardSnapshot;
use App\Actions\Whiteboards\WhiteboardGuard;
use App\Events\Whiteboards\WhiteboardDeleted;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class WhiteboardsController extends Controller
{
    public function show(Request $request, Whiteboard $board, BuildWhiteboardSnapshot $buildWhiteboardSnapshot): Response
    {
        return Inertia::render('whiteboards/show', [
            'snapshot' => $buildWhiteboardSnapshot->handle($board, WhiteboardMember::current($request)),
        ]);
    }

    public function destroy(Request $request, Whiteboard $board): HttpResponse
    {
        $member = WhiteboardMember::current($request);

        WhiteboardGuard::canDelete($board, $member);

        DB::transaction(function () use ($board, $member): void {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            WhiteboardGuard::canDelete($locked, $member);

            $boardId = $locked->id;

            $locked->delete();

            (new WhiteboardDeleted($boardId))->sendToOthers();
        });

        return response()->noContent();
    }
}
```

```php
<?php
// app/Http/Controllers/Whiteboards/WhiteboardSnapshotsController.php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\BuildWhiteboardSnapshot;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WhiteboardSnapshotsController extends Controller
{
    public function show(Request $request, Whiteboard $board, BuildWhiteboardSnapshot $buildWhiteboardSnapshot): JsonResponse
    {
        return response()->json($buildWhiteboardSnapshot->handle($board, WhiteboardMember::current($request)));
    }
}
```

- [ ] **Step 7: Routes and the placeholder page**

In `routes/web.php`, add the imports (alphabetical, with the others) and, inside the `w/{workspace}` group right after the `teams.pokerGames.store` line:

```php
            Route::post('teams/{team}/whiteboards', [TeamWhiteboardsController::class, 'store'])->name('teams.whiteboards.store');
```

After the `poker/{game}` group's closing `});`:

```php
Route::get('whiteboards/join/{guestToken}', [WhiteboardJoinsController::class, 'show'])->name('whiteboards.join.show');
Route::post('whiteboards/join/{guestToken}', [WhiteboardJoinsController::class, 'store'])->name('whiteboards.join.store')->middleware('throttle:10,1');

Route::prefix('whiteboards/{board}')
    ->whereUuid('board')
    ->middleware(ResolveWhiteboardMember::class)
    ->scopeBindings()
    ->group(function () {
        Route::get('/', [WhiteboardsController::class, 'show'])->name('whiteboards.show');
        Route::delete('/', [WhiteboardsController::class, 'destroy'])->name('whiteboards.destroy');
        Route::get('snapshot', [WhiteboardSnapshotsController::class, 'show'])->name('whiteboards.snapshot.show');
    });
```

Create the join controller as a stub so the route file loads; Task 4 fills it:

```php
<?php
// app/Http/Controllers/WhiteboardJoinsController.php

namespace App\Http\Controllers;

class WhiteboardJoinsController extends Controller {}
```

```tsx
// resources/js/pages/whiteboards/show.tsx
import { Head } from '@inertiajs/react';
import type { WhiteboardSnapshot } from '@/lib/whiteboard/types';

type Props = { snapshot: WhiteboardSnapshot };

export default function ShowWhiteboard({ snapshot }: Props) {
    return <Head title={snapshot.board.title} />;
}
```

```ts
// resources/js/lib/whiteboard/types.ts
import type { PresenceMember } from '@/lib/retro/types';

export type SceneElement = Record<string, unknown> & {
    id: string;
    type: string;
    version: number;
    versionNonce: number;
    isDeleted: boolean;
};

export type WhiteboardSnapshot = {
    board: {
        id: string;
        title: string;
        teamId: string;
        facilitatorMemberId: string | null;
        guestAccessEnabled: boolean;
        guestUrl: string | null;
        cursorsEnabled: boolean;
    };
    me: {
        id: string;
        userId: string | null;
        name: string;
        avatarUrl: string;
        isGuest: boolean;
        isFacilitator: boolean;
        canTakeControl: boolean;
        canDelete: boolean;
    };
    members: PresenceMember[];
    elements: SceneElement[];
    seq: number;
    links: { team: string | null };
    serverTime: string;
};

export type RejectReason = 'invalid' | 'stale' | 'locked' | 'file' | 'full';

export type WriteResponse = {
    seq: number;
    fromSeq: number;
    rejected: {
        id: string | null;
        reason: RejectReason;
        element: SceneElement | null;
    }[];
};

export type ElementsDelta = { seq: number; elements: SceneElement[] };

export type ElementsChangedPayload = {
    seq: number;
    fromSeq: number;
    elements?: SceneElement[];
};
```

In `resources/js/app.tsx`, add `case name === 'whiteboards/join':` under `case name === 'games/join':` and `case name === 'whiteboards/show':` under `case name === 'games/show':`.

- [ ] **Step 8: Add the translation keys of this task** (Appendix A, rows marked 3) to the four `lang/*.json` files.

- [ ] **Step 9: Run the tests**

Run: `php artisan test --compact tests/Feature/Whiteboards tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app routes resources lang tests
git commit -m "feat(whiteboard): create, enter and delete a team whiteboard"
```

---

### Task 4: Guest join, settings, facilitator, channel auth

**Files:**
- Modify: `app/Http/Controllers/WhiteboardJoinsController.php`, `app/Http/Controllers/BroadcastAuthorizationsController.php`, `routes/web.php`
- Create: `app/Http/Controllers/Whiteboards/WhiteboardSettingsController.php`, `WhiteboardGuestTokensController.php`, `WhiteboardFacilitatorsController.php`
- Create: `resources/js/pages/whiteboards/join.tsx`
- Test: `tests/Feature/Whiteboards/WhiteboardJoinTest.php`, `WhiteboardSettingsTest.php`, `WhiteboardFacilitationTest.php`, `WhiteboardBroadcastAuthorizationTest.php`

**Interfaces:**
- Consumes: `ResolveMember`, `WhiteboardGuard`, `WhiteboardChanged` (Task 3).
- Produces routes `whiteboards.join.show`, `whiteboards.join.store` (`{name}`), `whiteboards.settings.update` (`{title?, guest_access_enabled?, cursors_enabled?}` → 204), `whiteboards.guestToken.store` (→ `{guestUrl}`), `whiteboards.facilitator.update` (`{user_id}` → 204); presence channel `presence-whiteboard.{id}` with user info `{id, name, avatarUrl, isGuest}`.

- [ ] **Step 1: Write the failing tests**

```php
<?php
// tests/Feature/Whiteboards/WhiteboardJoinTest.php

use App\Actions\Retros\GuestCookie;
use App\Models\Whiteboard;
use Inertia\Testing\AssertableInertia as Assert;

it('shows the join form for a valid link', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create(['title' => 'Workshop']);

    $this->get(route('whiteboards.join.show', $board->guest_token))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('whiteboards/join')
            ->where('isInvalid', false)
            ->where('boardTitle', 'Workshop'));
});

it('answers 404 for an unknown or disabled link', function () {
    $board = Whiteboard::factory()->create();

    $this->get(route('whiteboards.join.show', $board->guest_token))
        ->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page->component('whiteboards/join')->where('isInvalid', true));

    $this->post(route('whiteboards.join.store', 'unknown'), ['name' => 'Ada'])->assertNotFound();
});

it('creates a guest member and sets the board cookie', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();

    $response = $this->post(route('whiteboards.join.store', $board->guest_token), ['name' => 'Ada'])
        ->assertRedirect(route('whiteboards.show', $board));

    $guest = $board->members()->sole();

    expect($guest->guest_name)->toBe('Ada')
        ->and($guest->user_id)->toBeNull();

    $response->assertCookie(GuestCookie::name(GuestCookie::WhiteboardScope, $board->id));
});

it('requires a name of at most 50 characters', function (string $name) {
    $board = Whiteboard::factory()->withGuestAccess()->create();

    $this->post(route('whiteboards.join.store', $board->guest_token), ['name' => $name])
        ->assertSessionHasErrors('name');
})->with(['empty' => '', 'too long' => str_repeat('a', 51)]);

it('sends team members straight to the board', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();

    $this->actingAs(teamMember($board->team))
        ->get(route('whiteboards.join.show', $board->guest_token))
        ->assertRedirect(route('whiteboards.show', $board));
});
```

```php
<?php
// tests/Feature/Whiteboards/WhiteboardSettingsTest.php

use App\Events\Whiteboards\WhiteboardChanged;
use App\Models\Whiteboard;
use Illuminate\Support\Facades\Event;

it('lets the facilitator change the title and the switches', function () {
    Event::fake([WhiteboardChanged::class]);

    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);

    $this->actingAs($user)
        ->patchJson(route('whiteboards.settings.update', $board), [
            'title' => 'Renamed',
            'guest_access_enabled' => true,
            'cursors_enabled' => false,
        ])
        ->assertNoContent();

    $board->refresh();

    expect($board->title)->toBe('Renamed')
        ->and($board->guest_access_enabled)->toBeTrue()
        ->and($board->cursors_enabled)->toBeFalse();

    Event::assertDispatched(WhiteboardChanged::class);
});

it('refuses settings from anyone else', function () {
    $board = Whiteboard::factory()->create(['title' => 'Kept']);
    whiteboardFacilitator($board);
    [$user] = whiteboardMember($board);

    $this->actingAs($user)
        ->patchJson(route('whiteboards.settings.update', $board), ['title' => 'Hijacked'])
        ->assertForbidden();

    expect($board->fresh()->title)->toBe('Kept');
});

it('validates the title', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);

    $this->actingAs($user)
        ->patchJson(route('whiteboards.settings.update', $board), ['title' => ''])
        ->assertJsonValidationErrors('title');
});

it('regenerates the guest link and signs every guest out', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    [$user] = whiteboardFacilitator($board);
    $guest = whiteboardGuest($board);
    $oldToken = $board->guest_token;

    $response = $this->actingAs($user)
        ->postJson(route('whiteboards.guestToken.store', $board))
        ->assertOk();

    $board->refresh();

    expect($board->guest_token)->not->toBe($oldToken)
        ->and($response->json('guestUrl'))->toBe(route('whiteboards.join.show', $board->guest_token))
        ->and($guest->fresh()->guest_secret_hash)->toBeNull()
        ->and($guest->fresh()->guest_name)->not->toBeNull();

    auth()->logout();

    $this->withUnencryptedCookies(whiteboardGuestCookie($guest))
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertForbidden();
});
```

```php
<?php
// tests/Feature/Whiteboards/WhiteboardFacilitationTest.php

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Whiteboard;

it('lets the facilitator hand over to a team member', function () {
    $board = Whiteboard::factory()->create();
    [$facilitator] = whiteboardFacilitator($board);
    $next = teamMember($board->team);

    $this->actingAs($facilitator)
        ->putJson(route('whiteboards.facilitator.update', $board), ['user_id' => $next->id])
        ->assertNoContent();

    expect($board->fresh()->facilitator?->user_id)->toBe($next->id);
});

it('refuses a hand-over to someone outside the team', function () {
    $board = Whiteboard::factory()->create();
    [$facilitator] = whiteboardFacilitator($board);
    $outsider = User::factory()->create();
    $board->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($facilitator)
        ->putJson(route('whiteboards.facilitator.update', $board), ['user_id' => $outsider->id])
        ->assertJsonValidationErrors('user_id');
});

it('lets a team member take control for themselves only', function () {
    $board = Whiteboard::factory()->create();
    whiteboardFacilitator($board);
    [$user] = whiteboardMember($board);
    [$other] = whiteboardMember($board);

    $this->actingAs($user)
        ->putJson(route('whiteboards.facilitator.update', $board), ['user_id' => $other->id])
        ->assertForbidden();

    $this->actingAs($user)
        ->putJson(route('whiteboards.facilitator.update', $board), ['user_id' => $user->id])
        ->assertNoContent();

    expect($board->fresh()->facilitator?->user_id)->toBe($user->id);
});

it('never lets a guest facilitate', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    [$facilitator] = whiteboardFacilitator($board);
    $guest = whiteboardGuest($board);

    $this->withUnencryptedCookies(whiteboardGuestCookie($guest))
        ->putJson(route('whiteboards.facilitator.update', $board), ['user_id' => $facilitator->id])
        ->assertForbidden();
});
```

```php
<?php
// tests/Feature/Whiteboards/WhiteboardBroadcastAuthorizationTest.php

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Whiteboard;

beforeEach(function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => 'test-app',
    ]);
});

function whiteboardChannelRequest(string $channelName): array
{
    return ['socket_id' => '1234.5678', 'channel_name' => $channelName];
}

it('signs presence data for a team member', function () {
    $board = Whiteboard::factory()->create();
    [$user, $member] = whiteboardMember($board);

    $response = $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), whiteboardChannelRequest("presence-whiteboard.{$board->id}"))
        ->assertOk();

    $channelData = json_decode($response->json('channel_data'), true);

    expect($response->json('auth'))->toStartWith('test-key:')
        ->and($channelData['user_id'])->toBe($member->id)
        ->and($channelData['user_info'])->toBe([
            'id' => $member->id,
            'name' => $user->name,
            'avatarUrl' => $member->avatarUrl(),
            'isGuest' => false,
        ]);
});

it('signs presence data for a guest', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    $guest = whiteboardGuest($board);

    $response = $this->withUnencryptedCookies(whiteboardGuestCookie($guest))
        ->postJson(route('broadcasting.auth'), whiteboardChannelRequest("presence-whiteboard.{$board->id}"))
        ->assertOk();

    expect(json_decode($response->json('channel_data'), true)['user_info']['isGuest'])->toBeTrue();
});

it('refuses outsiders, unknown boards and malformed names', function (Closure $channel) {
    $board = Whiteboard::factory()->create();
    $outsider = User::factory()->create();
    $board->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)
        ->postJson(route('broadcasting.auth'), whiteboardChannelRequest($channel($board)))
        ->assertForbidden();
})->with([
    'outsider' => [fn () => fn (Whiteboard $board) => "presence-whiteboard.{$board->id}"],
    'unknown board' => [fn () => fn () => 'presence-whiteboard.'.fake()->uuid()],
    'not a uuid' => [fn () => fn () => 'presence-whiteboard.nope'],
]);
```

- [ ] **Step 2: Run them to see them fail**

Run: `php artisan test --compact tests/Feature/Whiteboards`
Expected: the four new files FAIL (missing routes, missing channel branch).

- [ ] **Step 3: Join controller**

```php
<?php
// app/Http/Controllers/WhiteboardJoinsController.php

namespace App\Http\Controllers;

use App\Actions\Retros\GuestCookie;
use App\Actions\Whiteboards\ResolveMember;
use App\Models\Whiteboard;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class WhiteboardJoinsController extends Controller
{
    public function show(Request $request, string $guestToken, ResolveMember $resolveMember): Response
    {
        $board = $this->findBoard($guestToken);

        if ($board === null) {
            return $this->invalidLink($request);
        }

        if ($resolveMember->handle($request, $board) !== null) {
            return to_route('whiteboards.show', $board);
        }

        return Inertia::render('whiteboards/join', [
            'isInvalid' => false,
            'guestToken' => $guestToken,
            'boardTitle' => $board->title,
            'suggestedName' => $request->user()?->name,
        ])->toResponse($request);
    }

    public function store(Request $request, string $guestToken, ResolveMember $resolveMember): Response
    {
        $board = $this->findBoard($guestToken);

        if ($board === null) {
            return $this->invalidLink($request);
        }

        if ($resolveMember->handle($request, $board) !== null) {
            return to_route('whiteboards.show', $board);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50'],
        ]);

        $secret = Str::random(40);

        $member = $board->members()->create([
            'guest_name' => $validated['name'],
            'guest_secret_hash' => hash('sha256', $secret),
        ]);

        return to_route('whiteboards.show', $board)
            ->withCookie(GuestCookie::make(GuestCookie::WhiteboardScope, $board->id, $member->id, $secret));
    }

    private function findBoard(string $guestToken): ?Whiteboard
    {
        return Whiteboard::query()
            ->where('guest_token', $guestToken)
            ->where('guest_access_enabled', true)
            ->first();
    }

    private function invalidLink(Request $request): Response
    {
        return Inertia::render('whiteboards/join', ['isInvalid' => true])
            ->toResponse($request)
            ->setStatusCode(404);
    }
}
```

- [ ] **Step 4: Settings, guest token, facilitator controllers**

```php
<?php
// app/Http/Controllers/Whiteboards/WhiteboardSettingsController.php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\WhiteboardGuard;
use App\Events\Whiteboards\WhiteboardChanged;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class WhiteboardSettingsController extends Controller
{
    public function update(Request $request, Whiteboard $board): Response
    {
        $member = WhiteboardMember::current($request);

        WhiteboardGuard::facilitator($board, $member);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:120'],
            'guest_access_enabled' => ['sometimes', 'boolean'],
            'cursors_enabled' => ['sometimes', 'boolean'],
        ]);

        DB::transaction(function () use ($board, $member, $validated): void {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            WhiteboardGuard::facilitator($locked, $member);

            $locked->update($validated);

            (new WhiteboardChanged($locked->id))->sendToOthers();
        });

        return response()->noContent();
    }
}
```

```php
<?php
// app/Http/Controllers/Whiteboards/WhiteboardGuestTokensController.php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\WhiteboardGuard;
use App\Events\Whiteboards\WhiteboardChanged;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class WhiteboardGuestTokensController extends Controller
{
    public function store(Request $request, Whiteboard $board): JsonResponse
    {
        $member = WhiteboardMember::current($request);

        WhiteboardGuard::facilitator($board, $member);

        $guestToken = DB::transaction(function () use ($board, $member): string {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            WhiteboardGuard::facilitator($locked, $member);

            $locked->update(['guest_token' => Str::random(40)]);

            $locked->members()
                ->whereNull('user_id')
                ->whereNotNull('guest_secret_hash')
                ->update(['guest_secret_hash' => null]);

            (new WhiteboardChanged($locked->id))->sendToOthers();

            return $locked->guest_token;
        });

        return response()->json(['guestUrl' => route('whiteboards.join.show', $guestToken)]);
    }
}
```

```php
<?php
// app/Http/Controllers/Whiteboards/WhiteboardFacilitatorsController.php

namespace App\Http\Controllers\Whiteboards;

use App\Events\Whiteboards\WhiteboardChanged;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class WhiteboardFacilitatorsController extends Controller
{
    public function update(Request $request, Whiteboard $board): Response
    {
        $member = WhiteboardMember::current($request);

        if ($member->isGuest()) {
            throw new AuthorizationException(__('Only the facilitator can do this.'));
        }

        $validated = $request->validate([
            'user_id' => ['required', 'uuid', 'exists:users,id'],
        ]);

        $user = User::query()->whereKey($validated['user_id'])->firstOrFail();

        DB::transaction(function () use ($board, $member, $user): void {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            $locked->isFacilitator($member)
                ? $this->ensureCanHandOver($locked, $user)
                : $this->ensureTakesControl($locked, $member, $user);

            $newFacilitator = WhiteboardMember::query()->firstOrCreate(['whiteboard_id' => $locked->id, 'user_id' => $user->id]);

            $locked->update(['facilitator_member_id' => $newFacilitator->id]);

            (new WhiteboardChanged($locked->id))->sendToOthers();
        });

        return response()->noContent();
    }

    private function ensureCanHandOver(Whiteboard $locked, User $user): void
    {
        if ($user->can('view', $locked->team)) {
            return;
        }

        throw ValidationException::withMessages(['user_id' => __('The facilitator must be a member of this team.')]);
    }

    /**
     * A board outlives its sessions, so a missing facilitator must not
     * freeze it: any team member may make themselves facilitator.
     */
    private function ensureTakesControl(Whiteboard $locked, WhiteboardMember $member, User $user): void
    {
        if ($member->user_id !== $user->id || ! $user->can('view', $locked->team)) {
            throw new AuthorizationException(__('Only the facilitator can do this.'));
        }
    }
}
```

Add to the `whiteboards/{board}` route group:

```php
        Route::patch('settings', [WhiteboardSettingsController::class, 'update'])->name('whiteboards.settings.update');
        Route::post('guest-token', [WhiteboardGuestTokensController::class, 'store'])->name('whiteboards.guestToken.store');
        Route::put('facilitator', [WhiteboardFacilitatorsController::class, 'update'])->name('whiteboards.facilitator.update');
```

- [ ] **Step 5: Channel authorization**

In `app/Http/Controllers/BroadcastAuthorizationsController.php`: import `App\Actions\Whiteboards\ResolveMember` and `App\Models\Whiteboard`; add `ResolveMember $resolveMember,` to `store`'s parameters; add before the `presence-poker.` branch:

```php
        if (str_starts_with($validated['channel_name'], 'presence-whiteboard.')) {
            return $this->authorizeWhiteboardChannel($request, $validated, $resolveMember);
        }
```

and the method, after `authorizePokerChannel`:

```php
    /**
     * @param  array{socket_id: string, channel_name: string}  $validated
     */
    private function authorizeWhiteboardChannel(Request $request, array $validated, ResolveMember $resolveMember): JsonResponse
    {
        $boardId = Str::after($validated['channel_name'], 'presence-whiteboard.');

        abort_unless(Str::isUuid($boardId), 403);

        $board = Whiteboard::query()->find($boardId);

        abort_if($board === null, 403);
        abort_unless($board->id === $boardId, 403);

        $member = $resolveMember->handle($request, $board);

        abort_if($member === null, 403);

        $signature = $this->pusher()->authorizePresenceChannel(
            $validated['channel_name'],
            $validated['socket_id'],
            $member->id,
            [
                'id' => $member->id,
                'name' => $member->displayName(),
                'avatarUrl' => $member->avatarUrl(),
                'isGuest' => $member->isGuest(),
            ],
        );

        return response()->json(json_decode($signature, true));
    }
```

- [ ] **Step 6: Join page**

```tsx
// resources/js/pages/whiteboards/join.tsx
import { Form, Head } from '@inertiajs/react';
import WhiteboardJoinsController from '@/actions/App/Http/Controllers/WhiteboardJoinsController';
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
          boardTitle: string;
          suggestedName: string | null;
      };

export default function JoinWhiteboard(props: Props) {
    const { t } = useTrans();

    if (props.isInvalid) {
        return (
            <>
                <Head title={t('Join a whiteboard')} />
                <Heading
                    title={t('Join a whiteboard')}
                    description={t('This guest link is no longer valid.')}
                />
            </>
        );
    }

    return (
        <>
            <Head title={props.boardTitle} />
            <div className="space-y-6">
                <Heading
                    title={props.boardTitle}
                    description={t(
                        'Choose the name other participants will see.',
                    )}
                />
                <Form
                    {...WhiteboardJoinsController.store.form(props.guestToken)}
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

- [ ] **Step 7: Add the translation keys of this task** (Appendix A, rows marked 4).

- [ ] **Step 8: Run the tests**

Run: `php artisan test --compact tests/Feature/Whiteboards tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app routes resources lang tests
git commit -m "feat(whiteboard): guest join, settings, facilitator and channel authorization"
```

---

### Task 5: Element sanitizer

A pure class: raw decoded JSON in, clean element or `null` out. No database.

**Files:**
- Create: `app/Actions/Whiteboards/SanitizeWhiteboardElement.php`
- Test: `tests/Feature/Whiteboards/SanitizeWhiteboardElementTest.php`

**Interfaces:**
- Consumes: `sceneElement()` helper (Task 2); the key list checked in Task 1 Step 4.
- Produces: `SanitizeWhiteboardElement::handle(mixed $raw): ?array` — returns the element with only whitelisted keys, `isDeleted` and `locked` as booleans, `link` as an http(s) URL or `null`, `customData` either `['skrum' => ['kind' => 'sticky']]` or absent; `null` when the element must be rejected. Constants `MaxBytes = 65536`, `MaxTextLength = 10000`, `IdPattern = '/^[A-Za-z0-9_-]{1,40}$/'`, `FileIdPattern = '/^[A-Za-z0-9_-]{1,64}$/'`.

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Whiteboards/SanitizeWhiteboardElementTest.php

use App\Actions\Whiteboards\SanitizeWhiteboardElement;

function sanitizeElement(mixed $raw): ?array
{
    return (new SanitizeWhiteboardElement)->handle($raw);
}

it('keeps a well-formed element unchanged', function () {
    $element = sceneElement();

    expect(sanitizeElement($element))->toBe($element);
});

it('accepts every element type of the canvas', function (string $type, array $extra) {
    expect(sanitizeElement(sceneElement(['type' => $type, ...$extra])))->not->toBeNull();
})->with([
    'rectangle' => ['rectangle', []],
    'diamond' => ['diamond', []],
    'ellipse' => ['ellipse', []],
    'arrow' => ['arrow', ['points' => [[0, 0], [10, 10]], 'startBinding' => null, 'endBinding' => null]],
    'line' => ['line', ['points' => [[0, 0], [10, 10]]]],
    'freedraw' => ['freedraw', ['points' => [[0, 0], [1, 1]], 'pressures' => [0.5, 0.5], 'simulatePressure' => true]],
    'text' => ['text', ['text' => 'Hello', 'originalText' => 'Hello', 'fontSize' => 20, 'fontFamily' => 5, 'containerId' => null]],
    'image' => ['image', ['fileId' => 'abc123', 'status' => 'saved', 'scale' => [1, 1]]],
    'frame' => ['frame', ['name' => 'Ideas']],
]);

it('rejects what is not an element', function (mixed $raw) {
    expect(sanitizeElement($raw))->toBeNull();
})->with([
    'a string' => ['nope'],
    'null' => [null],
    'a list' => [[1, 2, 3]],
    'unknown type' => [fn () => sceneElement(['type' => 'iframe'])],
    'embeddable' => [fn () => sceneElement(['type' => 'embeddable'])],
    'no id' => [fn () => array_diff_key(sceneElement(), ['id' => true])],
    'id with a slash' => [fn () => sceneElement(['id' => 'a/b'])],
    'id too long' => [fn () => sceneElement(['id' => str_repeat('a', 41)])],
    'version zero' => [fn () => sceneElement(['version' => 0])],
    'version as text' => [fn () => sceneElement(['version' => '3'])],
    'negative nonce' => [fn () => sceneElement(['versionNonce' => -1])],
    'x as text' => [fn () => sceneElement(['x' => 'left'])],
    'infinite width' => [fn () => sceneElement(['width' => INF])],
    'not a number in points' => [fn () => sceneElement(['type' => 'line', 'points' => [[0, NAN]]])],
    'image without file' => [fn () => sceneElement(['type' => 'image', 'fileId' => null])],
    'image with a path as file' => [fn () => sceneElement(['type' => 'image', 'fileId' => '../etc/passwd'])],
]);

it('strips keys it does not know', function () {
    $clean = sanitizeElement(sceneElement(['authorMemberId' => 'someone', 'onclick' => 'alert(1)', 'text' => 'not for rectangles']));

    expect($clean)->not->toHaveKeys(['authorMemberId', 'onclick', 'text']);
});

it('keeps only http and https links', function (?string $link, ?string $expected) {
    expect(sanitizeElement(sceneElement(['link' => $link]))['link'])->toBe($expected);
})->with([
    ['https://example.com/a?b=1', 'https://example.com/a?b=1'],
    ['http://example.com', 'http://example.com'],
    ['javascript:alert(1)', null],
    ['JaVaScRiPt:alert(1)', null],
    ['data:text/html,<script>', null],
    ['/relative', null],
    ['', null],
    [null, null],
]);

it('keeps text byte for byte and limits its length', function () {
    $text = sceneElement(['type' => 'text', 'text' => "  two spaces\n", 'originalText' => '']);

    expect(sanitizeElement($text)['text'])->toBe("  two spaces\n")
        ->and(sanitizeElement($text)['originalText'])->toBe('')
        ->and(sanitizeElement(sceneElement(['type' => 'text', 'text' => str_repeat('é', 10_000)])))->not->toBeNull()
        ->and(sanitizeElement(sceneElement(['type' => 'text', 'text' => str_repeat('é', 10_001)])))->toBeNull()
        ->and(sanitizeElement(sceneElement(['type' => 'text', 'text' => ['an', 'array']])))->toBeNull();
});

it('reduces custom data to the sticky marker', function () {
    $sticky = sanitizeElement(sceneElement(['customData' => ['skrum' => ['kind' => 'sticky', 'masked' => true], 'other' => 1]]));
    $forged = sanitizeElement(sceneElement(['type' => 'ellipse', 'customData' => ['skrum' => ['kind' => 'sticky']]]));
    $junk = sanitizeElement(sceneElement(['customData' => ['skrum' => ['kind' => 'admin']]]));

    expect($sticky['customData'])->toBe(['skrum' => ['kind' => 'sticky']])
        ->and($forged)->not->toHaveKey('customData')
        ->and($junk)->not->toHaveKey('customData');
});

it('normalises the deleted and locked flags', function () {
    $clean = sanitizeElement(array_diff_key(sceneElement(['isDeleted' => 1]), ['locked' => true]));

    expect($clean['isDeleted'])->toBeTrue()
        ->and($clean['locked'])->toBeFalse();
});

it('rejects an element heavier than 64 KB', function () {
    $points = array_fill(0, 9000, [1.123456, 2.123456]);

    expect(sanitizeElement(sceneElement(['type' => 'freedraw', 'points' => $points])))->toBeNull()
        ->and(sanitizeElement(sceneElement(['type' => 'freedraw', 'points' => array_slice($points, 0, 500)])))->not->toBeNull();
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `php artisan test --compact tests/Feature/Whiteboards/SanitizeWhiteboardElementTest.php`
Expected: FAIL — class not found.

- [ ] **Step 3: Write the sanitizer**

Add to `TypeKeys` any key found in Task 1 Step 4 that is missing here.

```php
<?php
// app/Actions/Whiteboards/SanitizeWhiteboardElement.php

namespace App\Actions\Whiteboards;

class SanitizeWhiteboardElement
{
    public const MaxBytes = 65536;

    public const MaxTextLength = 10000;

    public const IdPattern = '/^[A-Za-z0-9_-]{1,40}$/';

    public const FileIdPattern = '/^[A-Za-z0-9_-]{1,64}$/';

    private const StickyType = 'rectangle';

    private const BaseKeys = [
        'id', 'type', 'x', 'y', 'width', 'height', 'angle', 'strokeColor', 'backgroundColor',
        'fillStyle', 'strokeWidth', 'strokeStyle', 'roughness', 'opacity', 'groupIds', 'frameId',
        'index', 'roundness', 'seed', 'version', 'versionNonce', 'isDeleted', 'boundElements',
        'updated', 'link', 'locked', 'customData',
    ];

    private const LinearKeys = [
        'points', 'lastCommittedPoint', 'startBinding', 'endBinding', 'startArrowhead', 'endArrowhead',
    ];

    private const TypeKeys = [
        'rectangle' => [],
        'diamond' => [],
        'ellipse' => [],
        'arrow' => [...self::LinearKeys, 'elbowed', 'fixedSegments', 'startIsSpecial', 'endIsSpecial'],
        'line' => [...self::LinearKeys, 'polygon'],
        'freedraw' => ['points', 'pressures', 'simulatePressure', 'lastCommittedPoint'],
        'text' => [
            'text', 'originalText', 'fontSize', 'fontFamily', 'textAlign', 'verticalAlign',
            'containerId', 'autoResize', 'lineHeight',
        ],
        'image' => ['fileId', 'status', 'scale', 'crop'],
        'frame' => ['name'],
    ];

    private const TextKeys = ['text', 'originalText'];

    /**
     * @return array<string, mixed>|null
     */
    public function handle(mixed $raw): ?array
    {
        if (! is_array($raw)) {
            return null;
        }

        $type = $raw['type'] ?? null;

        if (! is_string($type) || ! array_key_exists($type, self::TypeKeys)) {
            return null;
        }

        $element = array_intersect_key($raw, array_flip([...self::BaseKeys, ...self::TypeKeys[$type]]));

        if (! $this->hasValidIdentity($element)) {
            return null;
        }

        if (! $this->hasFiniteNumbers($element)) {
            return null;
        }

        if (! $this->hasValidText($element)) {
            return null;
        }

        if ($type === 'image' && ! $this->hasValidFile($element)) {
            return null;
        }

        $element['isDeleted'] = (bool) ($element['isDeleted'] ?? false);
        $element['locked'] = (bool) ($element['locked'] ?? false);
        $element['link'] = $this->safeLink($element['link'] ?? null);
        $element = $this->withStickyMarkerOnly($element, $type);

        if (strlen((string) json_encode($element)) > self::MaxBytes) {
            return null;
        }

        return $element;
    }

    /**
     * @param  array<string, mixed>  $element
     */
    private function hasValidIdentity(array $element): bool
    {
        $id = $element['id'] ?? null;

        if (! is_string($id) || preg_match(self::IdPattern, $id) !== 1) {
            return false;
        }

        $version = $element['version'] ?? null;

        if (! is_int($version) || $version < 1) {
            return false;
        }

        $nonce = $element['versionNonce'] ?? null;

        if (! is_int($nonce) || $nonce < 0) {
            return false;
        }

        foreach (['x', 'y', 'width', 'height'] as $key) {
            if (! is_int($element[$key] ?? null) && ! is_float($element[$key] ?? null)) {
                return false;
            }
        }

        return true;
    }

    private function hasFiniteNumbers(mixed $value): bool
    {
        if (is_float($value)) {
            return is_finite($value);
        }

        if (! is_array($value)) {
            return true;
        }

        foreach ($value as $item) {
            if (! $this->hasFiniteNumbers($item)) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  array<string, mixed>  $element
     */
    private function hasValidText(array $element): bool
    {
        foreach (self::TextKeys as $key) {
            if (! array_key_exists($key, $element)) {
                continue;
            }

            if (! is_string($element[$key])) {
                return false;
            }

            if (mb_strlen($element[$key]) > self::MaxTextLength) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  array<string, mixed>  $element
     */
    private function hasValidFile(array $element): bool
    {
        $fileId = $element['fileId'] ?? null;

        return is_string($fileId) && preg_match(self::FileIdPattern, $fileId) === 1;
    }

    private function safeLink(mixed $link): ?string
    {
        if (! is_string($link)) {
            return null;
        }

        if (preg_match('/^https?:\/\//i', $link) !== 1) {
            return null;
        }

        return $link;
    }

    /**
     * @param  array<string, mixed>  $element
     * @return array<string, mixed>
     */
    private function withStickyMarkerOnly(array $element, string $type): array
    {
        $kind = is_array($element['customData'] ?? null)
            ? ($element['customData']['skrum']['kind'] ?? null)
            : null;

        unset($element['customData']);

        if ($type !== self::StickyType || $kind !== 'sticky') {
            return $element;
        }

        return [...$element, 'customData' => ['skrum' => ['kind' => 'sticky']]];
    }
}
```

- [ ] **Step 4: Run the test**

Run: `php artisan test --compact tests/Feature/Whiteboards/SanitizeWhiteboardElementTest.php`
Expected: PASS. (The "keeps a well-formed element unchanged" case compares with `toBe`: key order must survive `array_intersect_key`, which keeps the input order.)

- [ ] **Step 5: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app/Actions/Whiteboards/SanitizeWhiteboardElement.php tests/Feature/Whiteboards/SanitizeWhiteboardElementTest.php
git commit -m "feat(whiteboard): sanitize incoming canvas elements"
```

---

### Task 6: Element writes, delta, broadcast, tombstone purge

**Files:**
- Create: `app/Actions/Whiteboards/WriteWhiteboardElements.php`, `PurgeWhiteboardTombstones.php`
- Create: `app/Events/Whiteboards/WhiteboardElementsChanged.php`
- Create: `app/Http/Controllers/Whiteboards/WhiteboardElementsController.php`
- Create: `app/Console/Commands/PruneWhiteboardsCommand.php`
- Modify: `routes/web.php`, `routes/console.php`, `app/Providers/AppServiceProvider.php`, `tests/Feature/Whiteboards/WhiteboardEventsTest.php`
- Test: `tests/Feature/Whiteboards/WhiteboardElementWritesTest.php`, `WhiteboardElementDeltaTest.php`, `PruneWhiteboardsTest.php`

**Interfaces:**
- Consumes: `SanitizeWhiteboardElement::handle(mixed): ?array`, `PresentWhiteboardElement::handle(WhiteboardElement, WhiteboardMember): array`, `Whiteboard::MaxLiveElements`.
- Produces:
  - `WriteWhiteboardElements::handle(Whiteboard $board, WhiteboardMember $member, array $rawElements): array{seq: int, fromSeq: int, rejected: list<array{id: ?string, reason: string, element: ?array}>}`; constants `MaxBatch = 200`, `MaxBroadcastBytes = 8000`.
  - `WhiteboardElementsChanged(string $boardId, int $seq, int $fromSeq, ?array $elements)` → `elements.changed` with `{seq, fromSeq}` plus `elements` when not null.
  - Routes `whiteboards.elements.index` (`GET elements?since=`) → `{seq, elements}` or 409; `whiteboards.elements.update` (`PUT elements`) → `{seq, fromSeq, rejected}`.
  - `PurgeWhiteboardTombstones::handle(): int` (rows purged); command `skrum:prune-whiteboards`.

- [ ] **Step 1: Write the failing tests**

```php
<?php
// tests/Feature/Whiteboards/WhiteboardElementWritesTest.php

use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;

beforeEach(function () {
    Event::fake([WhiteboardElementsChanged::class]);
});

function writeElements(mixed $test, Whiteboard $board, array $elements): mixed
{
    return $test->putJson(route('whiteboards.elements.update', $board), ['elements' => $elements]);
}

it('stores new elements, stamps the author and bumps the seq', function () {
    $board = Whiteboard::factory()->create();
    [$user, $member] = whiteboardMember($board);
    $first = sceneElement(['id' => 'first', 'authorMemberId' => 'forged']);
    $second = sceneElement(['id' => 'second']);

    writeElements($this->actingAs($user), $board, [$first, $second])
        ->assertOk()
        ->assertExactJson(['seq' => 2, 'fromSeq' => 0, 'rejected' => []]);

    $stored = $board->elements()->orderBy('seq')->get();

    expect($board->fresh()->seq)->toBe(2)
        ->and($stored->pluck('element_id')->all())->toBe(['first', 'second'])
        ->and($stored->pluck('seq')->all())->toBe([1, 2])
        ->and($stored[0]->author_member_id)->toBe($member->id)
        ->and($stored[0]->data)->not->toHaveKey('authorMemberId')
        ->and($stored[0]->version)->toBe(1)
        ->and($stored[0]->version_nonce)->toBe(100);

    Event::assertDispatched(WhiteboardElementsChanged::class, fn (WhiteboardElementsChanged $event) => $event->boardId === $board->id
        && $event->seq === 2
        && $event->fromSeq === 0
        && count($event->elements ?? []) === 2);
});

it('accepts a higher version and keeps the first author', function () {
    $board = Whiteboard::factory()->create(['seq' => 1]);
    [, $author] = whiteboardMember($board);
    [$editor] = whiteboardMember($board);
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'box', 'author_member_id' => $author->id]);

    writeElements($this->actingAs($editor), $board, [sceneElement(['id' => 'box', 'version' => 2, 'x' => 99])])
        ->assertOk()
        ->assertJsonPath('seq', 2)
        ->assertJsonPath('rejected', []);

    $stored = $board->elements()->sole();

    expect($stored->version)->toBe(2)
        ->and($stored->data['x'])->toBe(99)
        ->and($stored->author_member_id)->toBe($author->id);
});

it('rejects a stale version and returns the server copy', function () {
    $board = Whiteboard::factory()->create(['seq' => 5]);
    [$user] = whiteboardMember($board);
    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id, 'element_id' => 'box', 'version' => 3, 'version_nonce' => 50,
        'data' => sceneElement(['id' => 'box', 'version' => 3, 'versionNonce' => 50, 'x' => 7]),
    ]);

    writeElements($this->actingAs($user), $board, [sceneElement(['id' => 'box', 'version' => 2, 'x' => 99])])
        ->assertOk()
        ->assertJsonPath('seq', 5)
        ->assertJsonPath('fromSeq', 5)
        ->assertJsonPath('rejected.0.id', 'box')
        ->assertJsonPath('rejected.0.reason', 'stale')
        ->assertJsonPath('rejected.0.element.x', 7);

    Event::assertNotDispatched(WhiteboardElementsChanged::class);
});

it('breaks a version tie with the lower nonce', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id, 'element_id' => 'box', 'version' => 2, 'version_nonce' => 50,
        'data' => sceneElement(['id' => 'box', 'version' => 2, 'versionNonce' => 50, 'x' => 1]),
    ]);

    writeElements($this->actingAs($user), $board, [sceneElement(['id' => 'box', 'version' => 2, 'versionNonce' => 60, 'x' => 2])])
        ->assertJsonPath('rejected.0.reason', 'stale')
        ->assertJsonPath('rejected.0.element.x', 1);

    writeElements($this->actingAs($user), $board, [sceneElement(['id' => 'box', 'version' => 2, 'versionNonce' => 40, 'x' => 3])])
        ->assertJsonPath('rejected', []);

    expect($board->elements()->sole()->data['x'])->toBe(3);
});

it('treats a replayed batch as already applied', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    $batch = [sceneElement(['id' => 'box'])];

    writeElements($this->actingAs($user), $board, $batch)->assertJsonPath('seq', 1);

    Event::fake([WhiteboardElementsChanged::class]);

    writeElements($this->actingAs($user), $board, $batch)
        ->assertOk()
        ->assertExactJson(['seq' => 1, 'fromSeq' => 1, 'rejected' => []]);

    expect($board->fresh()->seq)->toBe(1);
    Event::assertNotDispatched(WhiteboardElementsChanged::class);
});

it('saves the good elements of a batch that holds bad ones', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    writeElements($this->actingAs($user), $board, [
        sceneElement(['id' => 'good']),
        'not an element',
        sceneElement(['id' => 'frame', 'type' => 'iframe']),
        sceneElement(['id' => 'heavy', 'type' => 'freedraw', 'points' => array_fill(0, 9000, [1.123456, 2.123456])]),
        sceneElement(['id' => 'linked', 'link' => 'javascript:alert(1)']),
    ])
        ->assertOk()
        ->assertJsonPath('seq', 2)
        ->assertJsonCount(3, 'rejected')
        ->assertJsonPath('rejected.0', ['id' => null, 'reason' => 'invalid', 'element' => null])
        ->assertJsonPath('rejected.1.id', 'frame')
        ->assertJsonPath('rejected.2.id', 'heavy');

    expect($board->elements()->pluck('element_id')->sort()->values()->all())->toBe(['good', 'linked'])
        ->and($board->elements()->where('element_id', 'linked')->sole()->data['link'])->toBeNull();
});

it('stores text exactly as typed', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    writeElements($this->actingAs($user), $board, [
        sceneElement(['id' => 'note', 'type' => 'text', 'text' => "  padded  \n", 'originalText' => '']),
    ])->assertJsonPath('rejected', []);

    $data = $board->elements()->sole()->data;

    expect($data['text'])->toBe("  padded  \n")
        ->and($data['originalText'])->toBe('');
});

it('records deletions as tombstones and flags sticky notes', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    writeElements($this->actingAs($user), $board, [
        sceneElement(['id' => 'sticky', 'customData' => ['skrum' => ['kind' => 'sticky']]]),
    ]);
    writeElements($this->actingAs($user), $board, [
        sceneElement(['id' => 'sticky', 'version' => 2, 'isDeleted' => true, 'customData' => ['skrum' => ['kind' => 'sticky']]]),
    ])->assertJsonPath('rejected', []);

    $stored = $board->elements()->sole();

    expect($stored->is_sticky)->toBeTrue()
        ->and($stored->is_deleted)->toBeTrue();
});

it('only lets the facilitator lock, unlock or change a locked element', function () {
    $board = Whiteboard::factory()->create();
    [$facilitator] = whiteboardFacilitator($board);
    [$member] = whiteboardMember($board);

    writeElements($this->actingAs($member), $board, [sceneElement(['id' => 'mine', 'locked' => true])])
        ->assertJsonPath('rejected.0.reason', 'locked')
        ->assertJsonPath('rejected.0.element', null);

    writeElements($this->actingAs($facilitator), $board, [sceneElement(['id' => 'frame', 'locked' => true])])
        ->assertJsonPath('rejected', []);

    writeElements($this->actingAs($member), $board, [sceneElement(['id' => 'frame', 'version' => 2, 'locked' => false, 'x' => 500])])
        ->assertJsonPath('rejected.0.reason', 'locked')
        ->assertJsonPath('rejected.0.element.locked', true);

    writeElements($this->actingAs($facilitator), $board, [sceneElement(['id' => 'frame', 'version' => 2, 'locked' => false])])
        ->assertJsonPath('rejected', []);

    expect($board->elements()->where('element_id', 'mine')->exists())->toBeFalse();
});

it('refuses new elements on a full board but still accepts edits and deletions', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'old']);

    $write = app(App\Actions\Whiteboards\WriteWhiteboardElements::class);
    $write->maxLiveElements = 1;

    writeElements($this->actingAs($user), $board, [
        sceneElement(['id' => 'new']),
        sceneElement(['id' => 'old', 'version' => 2, 'x' => 5]),
    ])
        ->assertJsonCount(1, 'rejected')
        ->assertJsonPath('rejected.0', ['id' => 'new', 'reason' => 'full', 'element' => null]);

    writeElements($this->actingAs($user), $board, [
        sceneElement(['id' => 'old', 'version' => 3, 'isDeleted' => true]),
        sceneElement(['id' => 'newer']),
    ])->assertJsonPath('rejected', []);
});

it('validates the envelope', function (array $payload) {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    $this->actingAs($user)
        ->putJson(route('whiteboards.elements.update', $board), $payload)
        ->assertJsonValidationErrors('elements');
})->with([
    'missing' => [[]],
    'empty' => [['elements' => []]],
    'not a list' => [['elements' => 'all of them']],
    'too many' => [['elements' => array_fill(0, 201, ['id' => 'x'])]],
]);

it('lets guests write and refuses outsiders', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    $guest = whiteboardGuest($board);

    writeElements($this->withUnencryptedCookies(whiteboardGuestCookie($guest)), $board, [sceneElement(['id' => 'guest'])])
        ->assertOk();

    expect($board->elements()->sole()->author_member_id)->toBe($guest->id);

    $board->update(['guest_access_enabled' => false]);

    writeElements($this->withUnencryptedCookies(whiteboardGuestCookie($guest)), $board, [sceneElement(['id' => 'late'])])
        ->assertForbidden();

    expect($board->elements()->count())->toBe(1);
});

it('sends ids only when the payload is too big for one message', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    $stroke = sceneElement(['id' => 'stroke', 'type' => 'freedraw', 'points' => array_fill(0, 600, [1.123456, 2.123456])]);

    writeElements($this->actingAs($user), $board, [$stroke])->assertJsonPath('rejected', []);

    Event::assertDispatched(WhiteboardElementsChanged::class, fn (WhiteboardElementsChanged $event) => $event->elements === null
        && $event->broadcastWith() === ['seq' => 1, 'fromSeq' => 0]);
});

it('throttles writes with the whiteboard limiter', function () {
    expect(Route::getRoutes()->getByName('whiteboards.elements.update')->gatherMiddleware())
        ->toContain('throttle:whiteboard-writes');
});
```

```php
<?php
// tests/Feature/Whiteboards/WhiteboardElementDeltaTest.php

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;

it('returns what changed after a seq, tombstones included', function () {
    $board = Whiteboard::factory()->create(['seq' => 3]);
    [$user] = whiteboardMember($board);
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'old', 'seq' => 1]);
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'new', 'seq' => 2]);
    WhiteboardElement::factory()->deleted()->create(['whiteboard_id' => $board->id, 'element_id' => 'gone', 'seq' => 3]);

    $this->actingAs($user)
        ->getJson(route('whiteboards.elements.index', [$board, 'since' => 1]))
        ->assertOk()
        ->assertJsonPath('seq', 3)
        ->assertJsonCount(2, 'elements')
        ->assertJsonPath('elements.0.id', 'new')
        ->assertJsonPath('elements.1.id', 'gone')
        ->assertJsonPath('elements.1.isDeleted', true);
});

it('answers 409 when the client is older than the last purge', function () {
    $board = Whiteboard::factory()->create(['seq' => 10, 'purged_seq' => 6]);
    [$user] = whiteboardMember($board);

    $this->actingAs($user)->getJson(route('whiteboards.elements.index', [$board, 'since' => 5]))->assertConflict();
    $this->actingAs($user)->getJson(route('whiteboards.elements.index', [$board, 'since' => 6]))->assertOk();
});

it('validates since', function (mixed $since) {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    $this->actingAs($user)
        ->getJson(route('whiteboards.elements.index', [$board, 'since' => $since]))
        ->assertJsonValidationErrors('since');
})->with(['negative' => -1, 'text' => 'abc', 'missing' => null]);
```

```php
<?php
// tests/Feature/Whiteboards/PruneWhiteboardsTest.php

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;

it('purges tombstones older than a day and remembers how far', function () {
    $board = Whiteboard::factory()->create(['seq' => 9]);
    $live = WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'seq' => 2]);

    $this->travelTo(now()->subHours(25));
    WhiteboardElement::factory()->deleted()->create(['whiteboard_id' => $board->id, 'seq' => 4]);
    WhiteboardElement::factory()->deleted()->create(['whiteboard_id' => $board->id, 'seq' => 6]);
    $this->travelBack();

    $recent = WhiteboardElement::factory()->deleted()->create(['whiteboard_id' => $board->id, 'seq' => 9]);

    $this->artisan('skrum:prune-whiteboards')->assertSuccessful();

    expect($board->elements()->pluck('id')->sort()->values()->all())
        ->toBe(collect([$live->id, $recent->id])->sort()->values()->all())
        ->and($board->fresh()->purged_seq)->toBe(6);
});

it('never lowers the purge mark', function () {
    $board = Whiteboard::factory()->create(['seq' => 9, 'purged_seq' => 8]);

    $this->travelTo(now()->subHours(25));
    WhiteboardElement::factory()->deleted()->create(['whiteboard_id' => $board->id, 'seq' => 3]);
    $this->travelBack();

    $this->artisan('skrum:prune-whiteboards')->assertSuccessful();

    expect($board->fresh()->purged_seq)->toBe(8);
});
```

Append to the dataset of `tests/Feature/Whiteboards/WhiteboardEventsTest.php` a separate test:

```php
it('carries elements in the change event only when it has them', function () {
    $with = new WhiteboardElementsChanged('b', 4, 3, [['id' => 'x']]);
    $without = new WhiteboardElementsChanged('b', 4, 3, null);

    expect($with->broadcastAs())->toBe('elements.changed')
        ->and($with->broadcastWith())->toBe(['seq' => 4, 'fromSeq' => 3, 'elements' => [['id' => 'x']]])
        ->and($without->broadcastWith())->toBe(['seq' => 4, 'fromSeq' => 3]);
});
```

(with `use App\Events\Whiteboards\WhiteboardElementsChanged;` at the top).

- [ ] **Step 2: Run them to see them fail**

Run: `php artisan test --compact tests/Feature/Whiteboards`
Expected: the new files FAIL (missing routes and classes).

- [ ] **Step 3: The event**

```php
<?php
// app/Events/Whiteboards/WhiteboardElementsChanged.php

namespace App\Events\Whiteboards;

class WhiteboardElementsChanged extends WhiteboardBroadcastEvent
{
    /**
     * @param  array<int, array<string, mixed>>|null  $elements  null when the payload would exceed one message; clients then fetch the delta
     */
    public function __construct(string $boardId, public int $seq, public int $fromSeq, public ?array $elements)
    {
        parent::__construct($boardId);
    }

    public function broadcastAs(): string
    {
        return 'elements.changed';
    }

    public function broadcastWith(): array
    {
        $payload = ['seq' => $this->seq, 'fromSeq' => $this->fromSeq];

        if ($this->elements === null) {
            return $payload;
        }

        return [...$payload, 'elements' => $this->elements];
    }
}
```

- [ ] **Step 4: The write action**

`maxLiveElements` is a public property so a test can lower it without creating 5 000 rows; bind the action as a singleton (Step 6) so the test and the controller share the instance.

```php
<?php
// app/Actions/Whiteboards/WriteWhiteboardElements.php

namespace App\Actions\Whiteboards;

use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * @phpstan-type Rejection array{id: ?string, reason: string, element: ?array<string, mixed>}
 * @phpstan-type Result array{seq: int, fromSeq: int, rejected: list<Rejection>}
 */
class WriteWhiteboardElements
{
    public const MaxBatch = 200;

    public const MaxBroadcastBytes = 8000;

    public int $maxLiveElements = Whiteboard::MaxLiveElements;

    public function __construct(
        private SanitizeWhiteboardElement $sanitizeWhiteboardElement,
        private PresentWhiteboardElement $presentWhiteboardElement,
    ) {}

    /**
     * @param  array<int, mixed>  $rawElements
     * @return Result
     */
    public function handle(Whiteboard $board, WhiteboardMember $member, array $rawElements): array
    {
        return DB::transaction(function () use ($board, $member, $rawElements): array {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            $fromSeq = $locked->seq;
            $seq = $fromSeq;
            $isFacilitator = $locked->isFacilitator($member);
            $stored = $this->storedElements($locked, $rawElements);
            $fileIds = $locked->files()->pluck('file_id')->flip();
            $liveCount = $locked->elements()->where('is_deleted', false)->count();
            $accepted = [];
            $rejected = [];

            foreach ($rawElements as $raw) {
                $element = $this->sanitizeWhiteboardElement->handle($raw);

                if ($element === null) {
                    $rejected[] = $this->rejection($this->rawId($raw), 'invalid', null, $member);

                    continue;
                }

                $existing = $stored->get($element['id']);

                if ($this->isSameWrite($existing, $element)) {
                    continue;
                }

                $reason = $this->refusal($existing, $element, $isFacilitator, $fileIds, $liveCount);

                if ($reason !== null) {
                    $rejected[] = $this->rejection($element['id'], $reason, $existing, $member);

                    continue;
                }

                $liveCount += $this->liveDelta($existing, $element);
                $seq++;

                $saved = $this->save($locked, $member, $existing, $element, $seq);

                $stored->put($element['id'], $saved);
                $accepted[$element['id']] = $saved;
            }

            if ($seq === $fromSeq) {
                return ['seq' => $seq, 'fromSeq' => $fromSeq, 'rejected' => $rejected];
            }

            $locked->update(['seq' => $seq]);

            (new WhiteboardElementsChanged($locked->id, $seq, $fromSeq, $this->broadcastable($accepted)))->sendToOthers();

            return ['seq' => $seq, 'fromSeq' => $fromSeq, 'rejected' => $rejected];
        });
    }

    /**
     * @param  array<int, mixed>  $rawElements
     * @return Collection<string, WhiteboardElement>
     */
    private function storedElements(Whiteboard $board, array $rawElements): Collection
    {
        $ids = collect($rawElements)
            ->map(fn (mixed $raw): ?string => $this->rawId($raw))
            ->filter()
            ->unique()
            ->values();

        return $board->elements()->whereIn('element_id', $ids)->get()->keyBy('element_id');
    }

    private function rawId(mixed $raw): ?string
    {
        if (! is_array($raw)) {
            return null;
        }

        $id = $raw['id'] ?? null;

        if (! is_string($id) || preg_match(SanitizeWhiteboardElement::IdPattern, $id) !== 1) {
            return null;
        }

        return $id;
    }

    /**
     * A client retrying after a timeout resends what the server already
     * holds; that is neither a change nor a conflict.
     *
     * @param  array<string, mixed>  $element
     */
    private function isSameWrite(?WhiteboardElement $existing, array $element): bool
    {
        return $existing !== null
            && $existing->version === $element['version']
            && $existing->version_nonce === $element['versionNonce'];
    }

    /**
     * @param  array<string, mixed>  $element
     * @param  Collection<string, int>  $fileIds
     */
    private function refusal(?WhiteboardElement $existing, array $element, bool $isFacilitator, Collection $fileIds, int $liveCount): ?string
    {
        if ($this->isStale($existing, $element)) {
            return 'stale';
        }

        if (! $isFacilitator && $this->touchesLock($existing, $element)) {
            return 'locked';
        }

        if ($element['type'] === 'image' && ! $element['isDeleted'] && ! $fileIds->has($element['fileId'])) {
            return 'file';
        }

        if ($this->liveDelta($existing, $element) > 0 && $liveCount >= $this->maxLiveElements) {
            return 'full';
        }

        return null;
    }

    /**
     * Excalidraw's own rule: the higher version wins, and on a tie the
     * lower nonce, so every client converges on the same copy.
     *
     * @param  array<string, mixed>  $element
     */
    private function isStale(?WhiteboardElement $existing, array $element): bool
    {
        if ($existing === null) {
            return false;
        }

        if ($element['version'] !== $existing->version) {
            return $element['version'] < $existing->version;
        }

        return $element['versionNonce'] > $existing->version_nonce;
    }

    /**
     * @param  array<string, mixed>  $element
     */
    private function touchesLock(?WhiteboardElement $existing, array $element): bool
    {
        return $element['locked'] || (bool) ($existing?->data['locked'] ?? false);
    }

    /**
     * @param  array<string, mixed>  $element
     */
    private function liveDelta(?WhiteboardElement $existing, array $element): int
    {
        $wasLive = $existing !== null && ! $existing->is_deleted;
        $isLive = ! $element['isDeleted'];

        return (int) $isLive - (int) $wasLive;
    }

    /**
     * @param  array<string, mixed>  $element
     */
    private function save(Whiteboard $board, WhiteboardMember $member, ?WhiteboardElement $existing, array $element, int $seq): WhiteboardElement
    {
        $attributes = [
            'type' => $element['type'],
            'data' => $element,
            'version' => $element['version'],
            'version_nonce' => $element['versionNonce'],
            'is_sticky' => isset($element['customData']),
            'is_deleted' => $element['isDeleted'],
            'seq' => $seq,
        ];

        if ($existing !== null) {
            $existing->update($attributes);

            return $existing;
        }

        return $board->elements()->create([
            ...$attributes,
            'element_id' => $element['id'],
            'author_member_id' => $member->id,
        ]);
    }

    /**
     * @return Rejection
     */
    private function rejection(?string $id, string $reason, ?WhiteboardElement $existing, WhiteboardMember $member): array
    {
        return [
            'id' => $id,
            'reason' => $reason,
            'element' => $existing === null ? null : $this->presentWhiteboardElement->handle($existing, $member),
        ];
    }

    /**
     * @param  array<string, WhiteboardElement>  $accepted
     * @return array<int, array<string, mixed>>|null
     */
    private function broadcastable(array $accepted): ?array
    {
        $elements = array_values(array_map(fn (WhiteboardElement $element): array => $element->data, $accepted));

        if (strlen((string) json_encode($elements)) > self::MaxBroadcastBytes) {
            return null;
        }

        return $elements;
    }
}
```

`broadcastable` serializes `data` directly: in 17a no element is viewer-specific. Plan 17d (private writing) replaces this with "ids only when a private sticky is in the batch".

- [ ] **Step 5: The controller**

The body is read from the raw request content, not `$request->input()`: the global `TrimStrings` and `ConvertEmptyStringsToNull` middleware would otherwise trim note text and turn `""` into `null`.

```php
<?php
// app/Http/Controllers/Whiteboards/WhiteboardElementsController.php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\PresentWhiteboardElement;
use App\Actions\Whiteboards\WriteWhiteboardElements;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class WhiteboardElementsController extends Controller
{
    public function index(Request $request, Whiteboard $board, PresentWhiteboardElement $presentWhiteboardElement): JsonResponse
    {
        $member = WhiteboardMember::current($request);

        $validated = $request->validate([
            'since' => ['required', 'integer', 'min:0'],
        ]);

        $since = (int) $validated['since'];

        abort_if($since < $board->purged_seq, 409, __('This board changed too much. Reloading it.'));

        return response()->json([
            'seq' => $board->seq,
            'elements' => $board->elements()
                ->where('seq', '>', $since)
                ->orderBy('seq')
                ->get()
                ->map(fn (WhiteboardElement $element): array => $presentWhiteboardElement->handle($element, $member))
                ->all(),
        ]);
    }

    public function update(Request $request, Whiteboard $board, WriteWhiteboardElements $writeWhiteboardElements): JsonResponse
    {
        $member = WhiteboardMember::current($request);

        $payload = json_decode($request->getContent(), true);

        $validated = Validator::make(is_array($payload) ? $payload : [], [
            'elements' => ['required', 'array', 'list', 'min:1', 'max:'.WriteWhiteboardElements::MaxBatch],
        ])->validate();

        return response()->json($writeWhiteboardElements->handle($board, $member, $validated['elements']));
    }
}
```

`Validator::validate()` returns only validated keys; because `elements` has no nested rules, its items come back untouched.

- [ ] **Step 6: Routes, limiter, singleton**

Route group additions:

```php
        Route::get('elements', [WhiteboardElementsController::class, 'index'])->name('whiteboards.elements.index');
        Route::put('elements', [WhiteboardElementsController::class, 'update'])->name('whiteboards.elements.update')->middleware('throttle:whiteboard-writes');
```

In `app/Providers/AppServiceProvider.php`: in `register()` add

```php
        $this->app->singleton(WriteWhiteboardElements::class);
```

and next to the existing `RateLimiter::for('mcp', …)`:

```php
        RateLimiter::for('whiteboard-writes', function (Request $request): Limit {
            $board = $request->route('board');
            $boardId = $board instanceof Whiteboard ? $board->id : (string) $board;

            return Limit::perSecond(20)->by(($request->user()?->id ?? $request->ip()).'|'.$boardId);
        });
```

(imports: `App\Actions\Whiteboards\WriteWhiteboardElements`, `App\Models\Whiteboard`). The key uses the user id or the IP rather than the member, because the throttle middleware runs before `ResolveWhiteboardMember`.

- [ ] **Step 7: Purge action, command, schedule**

```php
<?php
// app/Actions/Whiteboards/PurgeWhiteboardTombstones.php

namespace App\Actions\Whiteboards;

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use Illuminate\Support\Facades\DB;

class PurgeWhiteboardTombstones
{
    private const KeepHours = 24;

    public function handle(): int
    {
        $purged = 0;

        $expired = fn () => WhiteboardElement::query()
            ->where('is_deleted', true)
            ->where('updated_at', '<', now()->subHours(self::KeepHours));

        $expired()->distinct()->pluck('whiteboard_id')->each(function (string $boardId) use (&$purged, $expired): void {
            $purged += DB::transaction(function () use ($boardId, $expired): int {
                $board = Whiteboard::query()->whereKey($boardId)->lockForUpdate()->first();

                if ($board === null) {
                    return 0;
                }

                $highest = (int) $expired()->where('whiteboard_id', $boardId)->max('seq');

                Whiteboard::query()->whereKey($boardId)->update(['purged_seq' => max($board->purged_seq, $highest)]);

                return $expired()->where('whiteboard_id', $boardId)->delete();
            });
        });

        return $purged;
    }
}
```

The board is updated with a query, not `$board->update()`, so its `updated_at` (the team page's sort key) does not move.

```php
<?php
// app/Console/Commands/PruneWhiteboardsCommand.php

namespace App\Console\Commands;

use App\Actions\Whiteboards\PurgeWhiteboardTombstones;
use Illuminate\Console\Command;

class PruneWhiteboardsCommand extends Command
{
    protected $signature = 'skrum:prune-whiteboards';

    protected $description = 'Remove expired whiteboard tombstones and unused images';

    public function handle(PurgeWhiteboardTombstones $purgeWhiteboardTombstones): int
    {
        $this->info('Purging expired tombstones...');

        $tombstones = $purgeWhiteboardTombstones->handle();

        $this->comment("Purged {$tombstones} tombstones.");

        return self::SUCCESS;
    }
}
```

In `routes/console.php`, append:

```php
Schedule::command('skrum:prune-whiteboards')
    ->daily()
    ->withoutOverlapping()
    ->onOneServer();
```

- [ ] **Step 8: Add the translation key of this task** (Appendix A, row marked 6).

- [ ] **Step 9: Run the tests**

Run: `php artisan test --compact tests/Feature/Whiteboards tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app routes lang tests
git commit -m "feat(whiteboard): accept element writes by version, serve deltas and purge tombstones"
```

---

### Task 7: Images

**Files:**
- Create: `app/Http/Controllers/Whiteboards/WhiteboardFilesController.php`, `app/Actions/Whiteboards/PruneWhiteboardFiles.php`
- Modify: `app/Models/Whiteboard.php`, `app/Console/Commands/PruneWhiteboardsCommand.php`, `routes/web.php`
- Test: `tests/Feature/Whiteboards/WhiteboardFilesTest.php`; extend `PruneWhiteboardsTest.php`

**Interfaces:**
- Consumes: `Whiteboard::storageDirectory()`, `SanitizeWhiteboardElement::FileIdPattern`, the `file` rejection of Task 6.
- Produces: routes `whiteboards.files.store` (multipart `file`, `file_id`) → 201 `{id, url, mimeType}`; `whiteboards.files.show` (`{board}`, `{fileId}`) → the image; `Whiteboard::MaxFileKilobytes = 5120`, `Whiteboard::MaxStorageBytes = 104857600`; `PruneWhiteboardFiles::handle(): int`.

- [ ] **Step 1: Write the failing tests**

```php
<?php
// tests/Feature/Whiteboards/WhiteboardFilesTest.php

use App\Enums\WorkspaceRole;
use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardFile;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake();
    Event::fake([WhiteboardElementsChanged::class]);
});

function uploadBoardFile(mixed $test, Whiteboard $board, UploadedFile $file, string $fileId = 'abc123'): mixed
{
    return $test->post(route('whiteboards.files.store', $board), ['file' => $file, 'file_id' => $fileId], ['Accept' => 'application/json']);
}

it('stores an image and serves it back to members', function () {
    $board = Whiteboard::factory()->create();
    [$user, $member] = whiteboardMember($board);

    uploadBoardFile($this->actingAs($user), $board, UploadedFile::fake()->image('photo.png', 20, 20))
        ->assertCreated()
        ->assertJsonPath('id', 'abc123')
        ->assertJsonPath('mimeType', 'image/png')
        ->assertJsonPath('url', route('whiteboards.files.show', [$board, 'abc123'], absolute: false));

    $file = WhiteboardFile::query()->sole();

    expect($file->uploaded_by_member_id)->toBe($member->id)
        ->and($file->path)->toBe("whiteboards/{$board->id}/abc123");
    Storage::assertExists($file->path);

    $this->actingAs($user)
        ->get(route('whiteboards.files.show', [$board, 'abc123']))
        ->assertOk()
        ->assertHeader('Content-Type', 'image/png')
        ->assertHeader('X-Content-Type-Options', 'nosniff');
});

it('answers an upload that already exists without storing it twice', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    uploadBoardFile($this->actingAs($user), $board, UploadedFile::fake()->image('a.png'))->assertCreated();
    uploadBoardFile($this->actingAs($user), $board, UploadedFile::fake()->image('a.png'))->assertOk();

    expect(WhiteboardFile::query()->count())->toBe(1);
});

it('refuses what is not a png, jpeg, webp or gif, whatever its name says', function (UploadedFile $file) {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    uploadBoardFile($this->actingAs($user), $board, $file)->assertJsonValidationErrors('file');

    expect(WhiteboardFile::query()->count())->toBe(0);
})->with([
    'svg' => [fn () => UploadedFile::fake()->createWithContent('drawing.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
    'svg named png' => [fn () => UploadedFile::fake()->createWithContent('drawing.png', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
    'html named png' => [fn () => UploadedFile::fake()->createWithContent('page.png', '<html><script>alert(1)</script></html>')],
    'pdf' => [fn () => UploadedFile::fake()->create('doc.pdf', 10, 'application/pdf')],
]);

it('refuses files over 5 MB and boards over 100 MB', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    uploadBoardFile($this->actingAs($user), $board, UploadedFile::fake()->image('big.png')->size(5121))
        ->assertJsonValidationErrors('file');

    WhiteboardFile::factory()->create(['whiteboard_id' => $board->id, 'size' => Whiteboard::MaxStorageBytes - 100]);

    uploadBoardFile($this->actingAs($user), $board, UploadedFile::fake()->image('small.png')->size(1))
        ->assertJsonValidationErrors('file')
        ->assertJsonPath('errors.file.0', 'This board has reached its image storage limit.');
});

it('refuses a malformed file id', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    uploadBoardFile($this->actingAs($user), $board, UploadedFile::fake()->image('a.png'), '../../etc/passwd')
        ->assertJsonValidationErrors('file_id');
});

it('never serves a file to someone outside the board', function () {
    $board = Whiteboard::factory()->create();
    $file = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);
    Storage::put($file->path, 'bytes');

    $outsider = User::factory()->create();
    $board->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)->get(route('whiteboards.files.show', [$board, $file->file_id]))->assertForbidden();

    auth()->logout();

    $this->getJson(route('whiteboards.files.show', [$board, $file->file_id]))->assertUnauthorized();
});

it('does not serve the file of another board', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    $foreign = WhiteboardFile::factory()->create();
    Storage::put($foreign->path, 'bytes');

    $this->actingAs($user)->get(route('whiteboards.files.show', [$board, $foreign->file_id]))->assertNotFound();
});

it('rejects an image element whose file is unknown or belongs to another board', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    $foreign = WhiteboardFile::factory()->create();
    $own = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);

    $this->actingAs($user)
        ->putJson(route('whiteboards.elements.update', $board), ['elements' => [
            sceneElement(['id' => 'ghost', 'type' => 'image', 'fileId' => 'missing']),
            sceneElement(['id' => 'stolen', 'type' => 'image', 'fileId' => $foreign->file_id]),
            sceneElement(['id' => 'fine', 'type' => 'image', 'fileId' => $own->file_id]),
        ]])
        ->assertOk()
        ->assertJsonCount(2, 'rejected')
        ->assertJsonPath('rejected.0', ['id' => 'ghost', 'reason' => 'file', 'element' => null])
        ->assertJsonPath('rejected.1.id', 'stolen');

    expect($board->elements()->pluck('element_id')->all())->toBe(['fine']);
});

it('removes the stored images with the board', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);
    uploadBoardFile($this->actingAs($user), $board, UploadedFile::fake()->image('a.png'))->assertCreated();

    $this->actingAs($user)->deleteJson(route('whiteboards.destroy', $board))->assertNoContent();

    Storage::assertMissing("whiteboards/{$board->id}/abc123");
});
```

Append to `tests/Feature/Whiteboards/PruneWhiteboardsTest.php` (add `use App\Models\WhiteboardFile;` and `use Illuminate\Support\Facades\Storage;`):

```php
it('deletes day-old images no live element uses and the folders of gone boards', function () {
    Storage::fake();

    $board = Whiteboard::factory()->create();

    $this->travelTo(now()->subHours(25));
    $used = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);
    $unused = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);
    $ofDeleted = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);
    $this->travelBack();

    $fresh = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);

    foreach ([$used, $unused, $ofDeleted, $fresh] as $file) {
        Storage::put($file->path, 'bytes');
    }

    Storage::put('whiteboards/00000000-0000-0000-0000-000000000000/orphan', 'bytes');

    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id,
        'type' => 'image',
        'data' => sceneElement(['type' => 'image', 'fileId' => $used->file_id]),
    ]);
    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id,
        'type' => 'image',
        'is_deleted' => true,
        'data' => sceneElement(['type' => 'image', 'fileId' => $ofDeleted->file_id, 'isDeleted' => true]),
    ]);

    $this->artisan('skrum:prune-whiteboards')->assertSuccessful();

    expect(WhiteboardFile::query()->pluck('id')->sort()->values()->all())
        ->toBe(collect([$used->id, $fresh->id])->sort()->values()->all());

    Storage::assertExists($used->path);
    Storage::assertExists($fresh->path);
    Storage::assertMissing($unused->path);
    Storage::assertMissing($ofDeleted->path);
    Storage::assertMissing('whiteboards/00000000-0000-0000-0000-000000000000/orphan');
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `php artisan test --compact tests/Feature/Whiteboards/WhiteboardFilesTest.php tests/Feature/Whiteboards/PruneWhiteboardsTest.php`
Expected: FAIL — route `whiteboards.files.store` not defined.

- [ ] **Step 3: Model constants and cleanup on delete**

In `app/Models/Whiteboard.php`, add below `MaxLiveElements`:

```php
    public const MaxFileKilobytes = 5120;

    public const MaxStorageBytes = 104857600;
```

and (import `Illuminate\Support\Facades\Storage`):

```php
    protected static function booted(): void
    {
        static::deleted(function (Whiteboard $board): void {
            Storage::deleteDirectory($board->storageDirectory());
        });
    }
```

- [ ] **Step 4: The controller**

```php
<?php
// app/Http/Controllers/Whiteboards/WhiteboardFilesController.php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\SanitizeWhiteboardElement;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardFile;
use App\Models\WhiteboardMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class WhiteboardFilesController extends Controller
{
    private const MimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

    public function store(Request $request, Whiteboard $board): JsonResponse
    {
        $member = WhiteboardMember::current($request);

        $validated = $request->validate([
            'file_id' => ['required', 'string', 'regex:'.SanitizeWhiteboardElement::FileIdPattern],
            'file' => ['required', 'file', 'max:'.Whiteboard::MaxFileKilobytes],
        ]);

        /** @var UploadedFile $upload */
        $upload = $validated['file'];
        $mimeType = (string) $upload->getMimeType();

        if (! in_array($mimeType, self::MimeTypes, true)) {
            throw ValidationException::withMessages(['file' => __('Only PNG, JPEG, WebP and GIF images can be added.')]);
        }

        $existing = $board->files()->where('file_id', $validated['file_id'])->first();

        if ($existing !== null) {
            return response()->json($this->present($board, $existing));
        }

        $file = DB::transaction(function () use ($board, $member, $validated, $upload, $mimeType): WhiteboardFile {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            if ((int) $locked->files()->sum('size') + $upload->getSize() > Whiteboard::MaxStorageBytes) {
                throw ValidationException::withMessages(['file' => __('This board has reached its image storage limit.')]);
            }

            $path = Storage::putFileAs($locked->storageDirectory(), $upload, $validated['file_id']);

            abort_if($path === false, 500);

            return $locked->files()->create([
                'file_id' => $validated['file_id'],
                'path' => $path,
                'mime_type' => $mimeType,
                'size' => $upload->getSize(),
                'uploaded_by_member_id' => $member->id,
            ]);
        });

        return response()->json($this->present($board, $file), 201);
    }

    public function show(Whiteboard $board, string $fileId): StreamedResponse
    {
        $file = $board->files()->where('file_id', $fileId)->firstOrFail();

        return Storage::response($file->path, null, [
            'Content-Type' => $file->mime_type,
            'Content-Disposition' => 'inline',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, max-age=31536000, immutable',
        ]);
    }

    /**
     * @return array{id: string, url: string, mimeType: string}
     */
    private function present(Whiteboard $board, WhiteboardFile $file): array
    {
        return [
            'id' => $file->file_id,
            'url' => route('whiteboards.files.show', [$board, $file->file_id], absolute: false),
            'mimeType' => $file->mime_type,
        ];
    }
}
```

`getMimeType()` reads the content (finfo), not the client-supplied name or header, which is what refuses an SVG renamed to `.png`.

Route group additions:

```php
        Route::post('files', [WhiteboardFilesController::class, 'store'])->name('whiteboards.files.store');
        Route::get('files/{fileId}', [WhiteboardFilesController::class, 'show'])->name('whiteboards.files.show')->where('fileId', '[A-Za-z0-9_-]{1,64}');
```

- [ ] **Step 5: The prune action and the command**

```php
<?php
// app/Actions/Whiteboards/PruneWhiteboardFiles.php

namespace App\Actions\Whiteboards;

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;
use Illuminate\Support\Facades\Storage;

class PruneWhiteboardFiles
{
    private const KeepHours = 24;

    private const Root = 'whiteboards';

    public function handle(): int
    {
        $pruned = 0;

        WhiteboardFile::query()
            ->where('created_at', '<', now()->subHours(self::KeepHours))
            ->lazyById()
            ->each(function (WhiteboardFile $file) use (&$pruned): void {
                if ($this->isUsed($file)) {
                    return;
                }

                Storage::delete($file->path);
                $file->delete();
                $pruned++;
            });

        $this->deleteFoldersOfGoneBoards();

        return $pruned;
    }

    /**
     * Plans 17b and 17d add templates and versions as further users of a file.
     */
    private function isUsed(WhiteboardFile $file): bool
    {
        return WhiteboardElement::query()
            ->where('whiteboard_id', $file->whiteboard_id)
            ->where('type', 'image')
            ->where('is_deleted', false)
            ->where('data->fileId', $file->file_id)
            ->exists();
    }

    /**
     * A team or workspace deletion cascades in the database without model
     * events, so the board's folder outlives it.
     */
    private function deleteFoldersOfGoneBoards(): void
    {
        foreach (Storage::directories(self::Root) as $directory) {
            if (Whiteboard::query()->whereKey(basename($directory))->exists()) {
                continue;
            }

            Storage::deleteDirectory($directory);
        }
    }
}
```

In `PruneWhiteboardsCommand::handle`, add the parameter `PruneWhiteboardFiles $pruneWhiteboardFiles` and, before `return`:

```php
        $this->info('Pruning unused images...');

        $files = $pruneWhiteboardFiles->handle();

        $this->comment("Pruned {$files} images.");
```

- [ ] **Step 6: Add the translation keys of this task** (Appendix A, rows marked 7).

- [ ] **Step 7: Run the tests**

Run: `php artisan test --compact tests/Feature/Whiteboards tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app routes lang tests
git commit -m "feat(whiteboard): upload, serve and prune board images"
```

---

### Task 8: Team page

**Files:**
- Create: `app/Actions/Whiteboards/PresentWhiteboardSummary.php`
- Modify: `app/Http/Controllers/TeamsController.php`, `resources/js/pages/teams/show.tsx`, `resources/js/types/index.ts`
- Create: `resources/js/components/teams/whiteboards-section.tsx`, `new-whiteboard-dialog.tsx`
- Test: `tests/Feature/Whiteboards/TeamWhiteboardsSectionTest.php`

**Interfaces:**
- Consumes: `Team::whiteboards()`, `TeamPolicy::createWhiteboard`, route `teams.whiteboards.store`.
- Produces: team page props `whiteboards: {id, title, updatedAt, facilitatorName}[]` (newest first) and `canCreateWhiteboard: bool`; TS type `WhiteboardSummary`.

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Whiteboards/TeamWhiteboardsSectionTest.php

use App\Models\Team;
use App\Models\Whiteboard;
use Inertia\Testing\AssertableInertia as Assert;

it('lists the team boards, most recently changed first', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $this->travelTo(now()->subDay());
    $older = Whiteboard::factory()->create(['team_id' => $team->id, 'title' => 'Older']);
    $this->travelBack();

    $newer = Whiteboard::factory()->create(['team_id' => $team->id, 'title' => 'Newer']);
    [$facilitator] = whiteboardFacilitator($newer);
    Whiteboard::factory()->create();

    $this->actingAs($user)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/show')
            ->where('canCreateWhiteboard', true)
            ->has('whiteboards', 2)
            ->where('whiteboards.0.id', $newer->id)
            ->where('whiteboards.0.title', 'Newer')
            ->where('whiteboards.0.facilitatorName', $facilitator->name)
            ->where('whiteboards.0.updatedAt', $newer->updated_at->toIso8601String())
            ->where('whiteboards.1.id', $older->id)
            ->where('whiteboards.1.facilitatorName', null));
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `php artisan test --compact tests/Feature/Whiteboards/TeamWhiteboardsSectionTest.php`
Expected: FAIL — property `canCreateWhiteboard` missing.

- [ ] **Step 3: Presenter and controller**

```php
<?php
// app/Actions/Whiteboards/PresentWhiteboardSummary.php

namespace App\Actions\Whiteboards;

use App\Models\Whiteboard;

class PresentWhiteboardSummary
{
    /**
     * @return array{id: string, title: string, updatedAt: ?string, facilitatorName: ?string}
     */
    public function handle(Whiteboard $board): array
    {
        return [
            'id' => $board->id,
            'title' => $board->title,
            'updatedAt' => $board->updated_at?->toIso8601String(),
            'facilitatorName' => $board->facilitator?->displayName(),
        ];
    }
}
```

In `TeamsController`: add `private PresentWhiteboardSummary $presentWhiteboardSummary,` to the constructor, import it and `App\Models\Whiteboard`, and add to the `show` props after `canCreatePokerGame`:

```php
            'whiteboards' => $team->whiteboards()
                ->with('facilitator.user')
                ->latest('updated_at')
                ->get()
                ->map(fn (Whiteboard $board) => $this->presentWhiteboardSummary->handle($board)),
            'canCreateWhiteboard' => $request->user()->can('createWhiteboard', $team),
```

- [ ] **Step 4: Frontend**

In `resources/js/types/index.ts` (next to `PokerGameSummary`; if that type lives in another file re-exported from the index, put this beside it):

```ts
export type WhiteboardSummary = {
    id: string;
    title: string;
    updatedAt: string | null;
    facilitatorName: string | null;
};
```

```tsx
// resources/js/components/teams/new-whiteboard-dialog.tsx
import { useForm } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import TeamWhiteboardsController from '@/actions/App/Http/Controllers/TeamWhiteboardsController';
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
import { useTrans } from '@/hooks/use-trans';

type Props = { workspaceSlug: string; teamId: string };

export function NewWhiteboardDialog(props: Props) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>{t('New whiteboard')}</Button>
            </DialogTrigger>
            <DialogContent aria-describedby={undefined}>
                {open && <NewWhiteboardForm {...props} />}
            </DialogContent>
        </Dialog>
    );
}

function NewWhiteboardForm({ workspaceSlug, teamId }: Props) {
    const { t } = useTrans();
    const form = useForm({ title: '' });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        form.submit(
            TeamWhiteboardsController.store({
                workspace: workspaceSlug,
                team: teamId,
            }),
        );
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <DialogTitle>{t('New whiteboard')}</DialogTitle>
            <div className="grid gap-2">
                <Label htmlFor="whiteboard-title">{t('Title')}</Label>
                <Input
                    id="whiteboard-title"
                    required
                    maxLength={120}
                    autoFocus
                    value={form.data.title}
                    onChange={(event) =>
                        form.setData('title', event.target.value)
                    }
                />
                <InputError message={form.errors.title} />
            </div>
            <DialogFooter>
                <Button disabled={form.processing}>{t('Create')}</Button>
            </DialogFooter>
        </form>
    );
}
```

```tsx
// resources/js/components/teams/whiteboards-section.tsx
import { Link, usePage } from '@inertiajs/react';
import WhiteboardsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardsController';
import Heading from '@/components/heading';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardSummary } from '@/types';
import { NewWhiteboardDialog } from './new-whiteboard-dialog';

type Props = {
    workspaceSlug: string;
    teamId: string;
    boards: WhiteboardSummary[];
    canCreate: boolean;
};

export function WhiteboardsSection({
    workspaceSlug,
    teamId,
    boards,
    canCreate,
}: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const formatDate = new Intl.DateTimeFormat(locale as string, {
        dateStyle: 'medium',
    });

    return (
        <section className="space-y-3">
            <Heading variant="small" title={t('Whiteboards')} />

            {canCreate && (
                <NewWhiteboardDialog
                    workspaceSlug={workspaceSlug}
                    teamId={teamId}
                />
            )}

            {boards.length === 0 && (
                <p className="text-muted-foreground">
                    {t('No whiteboards yet.')}
                </p>
            )}

            {boards.length > 0 && (
                <ul className="divide-y rounded-md border">
                    {boards.map((board) => (
                        <li key={board.id}>
                            <Link
                                href={WhiteboardsController.show(board.id)}
                                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50"
                            >
                                <span className="font-medium">
                                    {board.title}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                    {board.facilitatorName &&
                                        t('Facilitated by :name', {
                                            name: board.facilitatorName,
                                        })}
                                    {board.facilitatorName &&
                                        board.updatedAt &&
                                        ' · '}
                                    {board.updatedAt &&
                                        formatDate.format(
                                            new Date(board.updatedAt),
                                        )}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
```

In `resources/js/pages/teams/show.tsx`: add `whiteboards: WhiteboardSummary[];` and `canCreateWhiteboard: boolean;` to the props type, destructure them, import `WhiteboardsSection`, and render it right after the `<PokerGamesSection … />` element:

```tsx
                <WhiteboardsSection
                    workspaceSlug={workspace.slug}
                    teamId={team.id}
                    boards={whiteboards}
                    canCreate={canCreateWhiteboard}
                />
```

(use the same expressions the neighbouring `PokerGamesSection` passes for `workspaceSlug` and `teamId`).

- [ ] **Step 5: Add the translation keys of this task** (Appendix A, rows marked 8).

- [ ] **Step 6: Verify**

Run: `php artisan test --compact tests/Feature/Whiteboards/TeamWhiteboardsSectionTest.php tests/Feature/TranslationKeysTest.php && npm run build && npm run types:check && npm run check`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app resources lang tests
git commit -m "feat(whiteboard): list and create whiteboards on the team page"
```

---

### Task 9: The board page — canvas and sync

No JavaScript unit runner exists in this repo (spec §14), so this task is verified by type-check, lint, build and a manual two-browser check; its server contract is already pinned by Tasks 3–7.

**Files:**
- Create: `resources/js/lib/whiteboard/files.ts`, `resources/js/lib/whiteboard/scene-sync.ts`
- Create: `resources/js/hooks/use-whiteboard-channel.ts`, `resources/js/hooks/use-whiteboard.ts`
- Create: `resources/js/components/whiteboard/board.tsx`, `top-bar.tsx`, `board-menu.tsx`, `board-gone.tsx`
- Modify: `resources/js/pages/whiteboards/show.tsx`

**Interfaces:**
- Consumes: `@/lib/whiteboard/excalidraw` (Task 1); types of `@/lib/whiteboard/types` (Task 3); `retroRequest`, `RetroRequestError` from `@/lib/retro/api`; Wayfinder actions of Tasks 3–7; `useSafeConnectionStatus` from `@/hooks/use-retro-channel`; `ConnectionBanner`, `SessionExpiredBanner`, `PresenceStrip` from `@/components/retro/`.
- Produces:
  - `createSceneSync(deps: SceneSyncDeps): SceneSync` with `SceneSync = { handleChange(elements: readonly SceneElement[]): void; handleRemote(payload: ElementsChangedPayload): void; resync(): Promise<void>; dispose(): void }`
  - `useWhiteboard(initial: WhiteboardSnapshot): WhiteboardState` with `{ snapshot, status: 'active' | 'ended' | 'deleted', sessionExpired, online, presence, connected, reconnecting, refetch, fail, onElementsChanged }`
  - `useWhiteboardChannel(boardId, enabled, handlers)` returning `{ online, connected, reconnecting, presence }`
  - `<Board snapshot />` default export of `components/whiteboard/board.tsx`

- [ ] **Step 1: Files helper**

```ts
// resources/js/lib/whiteboard/files.ts
import WhiteboardFilesController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardFilesController';

function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}

function toDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

export class FileRefusedError extends Error {}

/** Resolves when the server holds the file; throws FileRefusedError on a 4xx. */
export async function uploadBoardFile(
    boardId: string,
    fileId: string,
    dataUrl: string,
): Promise<void> {
    const blob = await (await fetch(dataUrl)).blob();
    const body = new FormData();

    body.append('file_id', fileId);
    body.append('file', blob, fileId);

    const response = await fetch(WhiteboardFilesController.store.url(boardId), {
        method: 'POST',
        body,
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrfToken() },
    });

    if (response.ok) {
        return;
    }

    if (response.status >= 400 && response.status < 500) {
        throw new FileRefusedError(String(response.status));
    }

    throw new Error(`upload failed: ${response.status}`);
}

export async function downloadBoardFile(
    boardId: string,
    fileId: string,
): Promise<{ dataURL: string; mimeType: string }> {
    const response = await fetch(
        WhiteboardFilesController.show.url({ board: boardId, fileId }),
        { credentials: 'same-origin' },
    );

    if (!response.ok) {
        throw new Error(`download failed: ${response.status}`);
    }

    const blob = await response.blob();

    return { dataURL: await toDataUrl(blob), mimeType: blob.type };
}
```

- [ ] **Step 2: Scene sync**

```ts
// resources/js/lib/whiteboard/scene-sync.ts
import WhiteboardElementsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardElementsController';
import WhiteboardSnapshotsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardSnapshotsController';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import {
    CaptureUpdateAction,
    reconcileElements,
    restoreElements,
    type ExcalidrawImperativeAPI,
} from './excalidraw';
import {
    FileRefusedError,
    downloadBoardFile,
    uploadBoardFile,
} from './files';
import type {
    ElementsChangedPayload,
    ElementsDelta,
    RejectReason,
    SceneElement,
    WhiteboardSnapshot,
    WriteResponse,
} from './types';

const FlushDelayMs = 300;
const RetryDelayMs = 2000;
const MaxBatch = 200;
const FatalStatuses = [401, 403, 404, 419];

export type SceneSyncDeps = {
    boardId: string;
    api: ExcalidrawImperativeAPI;
    initial: Pick<WhiteboardSnapshot, 'elements' | 'seq'>;
    onFatal: (error: RetroRequestError) => void;
    onRejected: (reason: RejectReason) => void;
    onOffline: (offline: boolean) => void;
};

export type SceneSync = {
    handleChange(elements: readonly SceneElement[]): void;
    handleRemote(payload: ElementsChangedPayload): void;
    resync(): Promise<void>;
    dispose(): void;
};

const stamp = (element: SceneElement) =>
    `${element.version}:${element.versionNonce}`;

const isFatal = (error: unknown): error is RetroRequestError =>
    error instanceof RetroRequestError && FatalStatuses.includes(error.status);

export function createSceneSync(deps: SceneSyncDeps): SceneSync {
    const { api, boardId } = deps;
    /** What the server is known to hold, per element. */
    const known = new Map<string, string>();
    const pending = new Map<string, SceneElement>();
    const files = new Set<string>();
    let seq = deps.initial.seq;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let flushing = false;
    let disposed = false;
    let resyncing: Promise<void> | null = null;

    const scene = () =>
        api.getSceneElementsIncludingDeleted() as unknown as SceneElement[];

    const setScene = (elements: SceneElement[]) => {
        api.updateScene({
            elements: elements as never,
            captureUpdate: CaptureUpdateAction.NEVER,
        });
    };

    const loadFile = (element: SceneElement) => {
        const fileId = element.fileId;

        if (
            element.type !== 'image' ||
            typeof fileId !== 'string' ||
            files.has(fileId)
        ) {
            return;
        }

        files.add(fileId);

        downloadBoardFile(boardId, fileId)
            .then(({ dataURL, mimeType }) => {
                if (disposed) {
                    return;
                }

                api.addFiles([
                    {
                        id: fileId,
                        dataURL,
                        mimeType,
                        created: Date.now(),
                    } as never,
                ]);
            })
            .catch(() => files.delete(fileId));
    };

    const remember = (elements: readonly SceneElement[]) => {
        for (const element of elements) {
            known.set(element.id, stamp(element));
            loadFile(element);
        }
    };

    /** Merge by Excalidraw's rule: the local copy survives when it is newer. */
    const applyRemote = (elements: SceneElement[]) => {
        if (elements.length === 0) {
            return;
        }

        const remote = restoreElements(elements as never, null);

        setScene(
            reconcileElements(
                scene() as never,
                remote as never,
                api.getAppState(),
            ) as unknown as SceneElement[],
        );
        remember(elements);
    };

    /** Replace local copies whatever their version: the server refused ours. */
    const force = (elements: SceneElement[]) => {
        const byId = new Map(elements.map((element) => [element.id, element]));
        const merged = scene().map((element) => {
            const forced = byId.get(element.id);

            byId.delete(element.id);

            return forced ?? element;
        });

        setScene(
            restoreElements(
                [...merged, ...byId.values()] as never,
                null,
            ) as unknown as SceneElement[],
        );
        remember(elements);
    };

    const dropLocally = (id: string) => {
        const local = scene().find((element) => element.id === id);

        if (!local) {
            return;
        }

        pending.delete(id);
        known.set(id, stamp(local));
        setScene(
            scene().map((element) =>
                element.id === id ? { ...element, isDeleted: true } : element,
            ),
        );
        known.set(id, stamp(scene().find((element) => element.id === id)!));
    };

    const schedule = (delay: number) => {
        if (timer !== null || disposed) {
            return;
        }

        timer = setTimeout(() => {
            timer = null;
            void flush();
        }, delay);
    };

    const requeue = (elements: SceneElement[]) => {
        for (const element of elements) {
            if (!pending.has(element.id)) {
                pending.set(element.id, element);
            }
        }
    };

    /** Images go up before the element that shows them (spec §6.5). */
    const withUploadedFiles = async (
        batch: SceneElement[],
    ): Promise<SceneElement[]> => {
        const ready: SceneElement[] = [];

        for (const element of batch) {
            const fileId = element.fileId;

            if (
                element.type !== 'image' ||
                element.isDeleted ||
                typeof fileId !== 'string' ||
                files.has(fileId)
            ) {
                ready.push(element);

                continue;
            }

            const file = api.getFiles()[fileId];

            if (!file) {
                requeue([element]);

                continue;
            }

            try {
                await uploadBoardFile(boardId, fileId, file.dataURL);
                files.add(fileId);
                ready.push(element);
            } catch (error) {
                if (!(error instanceof FileRefusedError)) {
                    throw error;
                }

                dropLocally(element.id);
                deps.onRejected('file');
            }
        }

        return ready;
    };

    const settle = (response: WriteResponse) => {
        for (const rejection of response.rejected) {
            if (rejection.element) {
                force([rejection.element]);
            } else if (rejection.id) {
                dropLocally(rejection.id);
            }

            if (rejection.reason !== 'stale') {
                deps.onRejected(rejection.reason);
            }
        }
    };

    const flush = async (): Promise<void> => {
        if (flushing || disposed || pending.size === 0) {
            return;
        }

        flushing = true;

        const batch = [...pending.values()].slice(0, MaxBatch);

        for (const element of batch) {
            pending.delete(element.id);
        }

        try {
            const ready = await withUploadedFiles(batch);

            if (ready.length > 0) {
                const response = await retroRequest<WriteResponse>(
                    WhiteboardElementsController.update(boardId),
                    { elements: ready },
                );

                for (const element of ready) {
                    known.set(element.id, stamp(element));
                }

                settle(response);

                if (response.fromSeq === seq) {
                    seq = response.seq;
                } else if (response.seq > seq) {
                    await resync();
                }
            }

            deps.onOffline(false);
        } catch (error) {
            if (isFatal(error)) {
                deps.onFatal(error);

                return;
            }

            requeue(batch);
            deps.onOffline(true);
        } finally {
            flushing = false;

            if (pending.size > 0) {
                schedule(RetryDelayMs);
            }
        }
    };

    /** The server purged tombstones we never saw: start from its scene. */
    const replaceScene = async () => {
        const snapshot = await retroRequest<WhiteboardSnapshot>(
            WhiteboardSnapshotsController.show(boardId),
        );
        const alive = new Set(snapshot.elements.map((element) => element.id));

        setScene(
            scene().map((element) =>
                alive.has(element.id) ||
                pending.has(element.id) ||
                !known.has(element.id)
                    ? element
                    : { ...element, isDeleted: true },
            ),
        );
        remember(scene().filter((element) => !alive.has(element.id)));
        force(snapshot.elements);
        seq = snapshot.seq;
    };

    const resync = (): Promise<void> => {
        resyncing ??= (async () => {
            try {
                const delta = await retroRequest<ElementsDelta>(
                    WhiteboardElementsController.index(boardId, {
                        query: { since: seq },
                    }),
                );

                applyRemote(delta.elements);
                seq = Math.max(seq, delta.seq);
                deps.onOffline(false);
            } catch (error) {
                if (isFatal(error)) {
                    deps.onFatal(error);
                } else if (
                    error instanceof RetroRequestError &&
                    error.status === 409
                ) {
                    await replaceScene().catch(() => deps.onOffline(true));
                } else {
                    deps.onOffline(true);
                }
            } finally {
                resyncing = null;
            }
        })();

        return resyncing;
    };

    remember(deps.initial.elements);

    return {
        handleChange(elements) {
            for (const element of elements) {
                const seen = known.get(element.id);

                if (seen === stamp(element)) {
                    continue;
                }

                if (seen === undefined && element.isDeleted) {
                    continue;
                }

                pending.set(element.id, element);
            }

            if (pending.size > 0) {
                schedule(FlushDelayMs);
            }
        },
        handleRemote(payload) {
            if (payload.seq <= seq) {
                return;
            }

            if (payload.elements && payload.fromSeq === seq) {
                applyRemote(payload.elements);
                seq = payload.seq;

                return;
            }

            void resync();
        },
        resync,
        dispose() {
            disposed = true;

            if (timer !== null) {
                clearTimeout(timer);
            }
        },
    };
}
```

Two points an implementer must not "simplify":
- `handleChange` is called for remote updates too (Excalidraw fires `onChange` after `updateScene`). It is `known` that stops an echo: a remote element's stamp equals what the server holds, so it is not queued. Do not add an "applying remote" flag; `onChange` fires asynchronously and a flag would drop real edits.
- A flush in progress sends the element as it was when the batch was taken; edits made meanwhile have a new stamp, are queued again by the next `onChange`, and go out in the next flush.

If Wayfinder's generated `index` does not accept `{ query }` as its second argument, check the signature in `resources/js/actions/App/Http/Controllers/Whiteboards/WhiteboardElementsController.ts` after `npm run build` and adapt the call (the `wayfinder-development` skill documents query parameters).

- [ ] **Step 3: Channel hook**

```ts
// resources/js/hooks/use-whiteboard-channel.ts
import { echo, echoIsConfigured } from '@laravel/echo-react';
import { useEffect, useRef, useState } from 'react';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';
import type { PresenceMember } from '@/lib/retro/types';
import { useSafeConnectionStatus } from './use-retro-channel';

export const WhiteboardEvents = [
    'elements.changed',
    'board.changed',
    'board.deleted',
] as const;

/**
 * The presence subscription completes moments after the socket (on load
 * and on every reconnect); waiting briefly lets one resync cover both.
 */
const ResyncCoalesceMs = 250;

export type WhiteboardEventName = (typeof WhiteboardEvents)[number];

export type WhiteboardEvent = {
    name: WhiteboardEventName;
    payload: Record<string, unknown>;
};

export type WhiteboardChannelHandlers = {
    onEvent: (event: WhiteboardEvent) => void;
    onResync: () => void;
    onLeaving?: (member: PresenceMember) => void;
};

/** A member open in two tabs is one presence member with the same id. */
function withMember(
    members: PresenceMember[],
    member: PresenceMember,
): PresenceMember[] {
    return [...members.filter((known) => known.id !== member.id), member];
}

export function useWhiteboardChannel(
    boardId: string,
    enabled: boolean,
    channelHandlers: WhiteboardChannelHandlers,
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

        const name = `whiteboard.${boardId}`;
        const channel = echo<'reverb'>()
            .join(name)
            .here((members: PresenceMember[]) => {
                setOnline(members.reduce<PresenceMember[]>(withMember, []));
                scheduleResync();
            })
            .joining((member: PresenceMember) => {
                setOnline((current) => withMember(current, member));
            })
            .leaving((member: PresenceMember) => {
                setOnline((current) =>
                    current.filter((known) => known.id !== member.id),
                );
                handlers.current.onLeaving?.(member);
            })
            .error(scheduleResync);

        setPresence(channel as unknown as WhisperChannel);

        for (const event of WhiteboardEvents) {
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
    }, [boardId, enabled]);

    const connected = status === 'connected';
    const reconnecting = status === 'failed' || (wasConnected && !connected);

    return { online, connected, reconnecting, presence };
}
```

- [ ] **Step 4: Board state hook**

```ts
// resources/js/hooks/use-whiteboard.ts
import { useCallback, useRef, useState } from 'react';
import WhiteboardSnapshotsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardSnapshotsController';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { PresenceMember } from '@/lib/retro/types';
import type {
    ElementsChangedPayload,
    WhiteboardSnapshot,
} from '@/lib/whiteboard/types';
import { useWhiteboardChannel } from './use-whiteboard-channel';

const SessionExpiredStatuses = [401, 419];

export type BoardStatus = 'active' | 'ended' | 'deleted';

type BoardMeta = Pick<WhiteboardSnapshot, 'board' | 'me' | 'members' | 'links'>;

export type SceneListeners = {
    onElementsChanged: (payload: ElementsChangedPayload) => void;
    onResync: () => void;
    onLeaving: (member: PresenceMember) => void;
};

export type WhiteboardState = {
    snapshot: BoardMeta;
    status: BoardStatus;
    sessionExpired: boolean;
    online: PresenceMember[];
    presence: WhisperChannel | null;
    connected: boolean;
    reconnecting: boolean;
    refetch: () => Promise<void>;
    fail: (error: RetroRequestError) => void;
    listeners: { current: SceneListeners | null };
};

/**
 * Board settings, members and access. The scene itself lives in Excalidraw
 * and is kept in step by scene-sync, which registers itself in `listeners`.
 */
export function useWhiteboard(initial: WhiteboardSnapshot): WhiteboardState {
    const [snapshot, setSnapshot] = useState<BoardMeta>(initial);
    const [status, setStatus] = useState<BoardStatus>('active');
    const [sessionExpired, setSessionExpired] = useState(false);
    const listeners = useRef<SceneListeners | null>(null);
    const latestRefetch = useRef(0);
    const boardId = initial.board.id;

    const fail = useCallback((error: RetroRequestError) => {
        if (SessionExpiredStatuses.includes(error.status)) {
            setSessionExpired(true);

            return;
        }

        setStatus(error.status === 404 ? 'deleted' : 'ended');
    }, []);

    const refetch = useCallback(async () => {
        const request = ++latestRefetch.current;

        try {
            const fresh = await retroRequest<WhiteboardSnapshot>(
                WhiteboardSnapshotsController.show(boardId),
            );

            if (request !== latestRefetch.current) {
                return;
            }

            setSnapshot({
                board: fresh.board,
                me: fresh.me,
                members: fresh.members,
                links: fresh.links,
            });
        } catch (error) {
            if (
                error instanceof RetroRequestError &&
                [401, 403, 404, 419].includes(error.status)
            ) {
                fail(error);
            }
        }
    }, [boardId, fail]);

    const channel = useWhiteboardChannel(boardId, status === 'active', {
        onEvent: ({ name, payload }) => {
            if (name === 'board.deleted') {
                setStatus('deleted');

                return;
            }

            if (name === 'board.changed') {
                void refetch();

                return;
            }

            listeners.current?.onElementsChanged(
                payload as ElementsChangedPayload,
            );
        },
        onResync: () => {
            void refetch();
            listeners.current?.onResync();
        },
        onLeaving: (member) => listeners.current?.onLeaving(member),
    });

    return {
        snapshot,
        status,
        sessionExpired,
        ...channel,
        refetch,
        fail,
        listeners,
    };
}
```

- [ ] **Step 5: UI around the canvas**

```tsx
// resources/js/components/whiteboard/board-gone.tsx
import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export function BoardGone({
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
                    ? t('This board was deleted.')
                    : t('Your access to this board has ended.')}
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

```tsx
// resources/js/components/whiteboard/board-menu.tsx
import { router } from '@inertiajs/react';
import { Menu } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import WhiteboardFacilitatorsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardFacilitatorsController';
import WhiteboardGuestTokensController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardGuestTokensController';
import WhiteboardSettingsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardSettingsController';
import WhiteboardsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardsController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardState } from '@/hooks/use-whiteboard';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';

type Props = {
    state: WhiteboardState;
    hideMyCursor: boolean;
    onHideMyCursorChange: (hidden: boolean) => void;
};

export function BoardMenu({ state, hideMyCursor, onHideMyCursorChange }: Props) {
    const { t } = useTrans();
    const { board, me, links } = state.snapshot;
    const [renaming, setRenaming] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    const run = async (request: Promise<unknown>) => {
        try {
            await request;
            await state.refetch();
        } catch (error) {
            if (error instanceof RetroRequestError) {
                toast.error(error.message);
            }
        }
    };

    const updateSettings = (settings: Record<string, unknown>) =>
        run(
            retroRequest(
                WhiteboardSettingsController.update(board.id),
                settings,
            ),
        );

    const copyGuestLink = async () => {
        if (!board.guestUrl) {
            return;
        }

        await navigator.clipboard.writeText(board.guestUrl);
        toast.success(t('Link copied.'));
    };

    const deleteBoard = async () => {
        await run(retroRequest(WhiteboardsController.destroy(board.id)));

        if (links.team) {
            router.visit(links.team);
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        size="icon"
                        variant="outline"
                        aria-label={t('Board menu')}
                    >
                        <Menu className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuCheckboxItem
                        checked={hideMyCursor}
                        onCheckedChange={onHideMyCursorChange}
                    >
                        {t('Hide my cursor')}
                    </DropdownMenuCheckboxItem>
                    {me.canTakeControl && me.userId && (
                        <DropdownMenuItem
                            onSelect={() =>
                                run(
                                    retroRequest(
                                        WhiteboardFacilitatorsController.update(
                                            board.id,
                                        ),
                                        { user_id: me.userId },
                                    ),
                                )
                            }
                        >
                            {t('Take control')}
                        </DropdownMenuItem>
                    )}
                    {me.isFacilitator && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onSelect={() => setRenaming(true)}
                            >
                                {t('Rename')}
                            </DropdownMenuItem>
                            <DropdownMenuCheckboxItem
                                checked={board.cursorsEnabled}
                                onCheckedChange={(checked) =>
                                    updateSettings({ cursors_enabled: checked })
                                }
                            >
                                {t('Show live cursors')}
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                                checked={board.guestAccessEnabled}
                                onCheckedChange={(checked) =>
                                    updateSettings({
                                        guest_access_enabled: checked,
                                    })
                                }
                            >
                                {t('Allow guests to join with a link')}
                            </DropdownMenuCheckboxItem>
                            {board.guestAccessEnabled && (
                                <DropdownMenuItem
                                    onSelect={() =>
                                        run(
                                            retroRequest(
                                                WhiteboardGuestTokensController.store(
                                                    board.id,
                                                ),
                                            ),
                                        )
                                    }
                                >
                                    {t('Replace the guest link')}
                                </DropdownMenuItem>
                            )}
                        </>
                    )}
                    {!me.isGuest && board.guestAccessEnabled && (
                        <DropdownMenuItem onSelect={copyGuestLink}>
                            {t('Copy the guest link')}
                        </DropdownMenuItem>
                    )}
                    {me.canDelete && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setConfirmingDelete(true)}
                            >
                                {t('Delete this board')}
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={renaming} onOpenChange={setRenaming}>
                <DialogContent aria-describedby={undefined}>
                    {renaming && (
                        <RenameForm
                            title={board.title}
                            onSubmit={async (title) => {
                                await updateSettings({ title });
                                setRenaming(false);
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
                <DialogContent aria-describedby={undefined}>
                    <DialogTitle>{t('Delete this board?')}</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        {t('Everything on it is removed for everyone.')}
                    </p>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setConfirmingDelete(false)}
                        >
                            {t('Cancel')}
                        </Button>
                        <Button variant="destructive" onClick={deleteBoard}>
                            {t('Delete this board')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function RenameForm({
    title,
    onSubmit,
}: {
    title: string;
    onSubmit: (title: string) => Promise<void>;
}) {
    const { t } = useTrans();
    const [value, setValue] = useState(title);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        void onSubmit(value);
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <DialogTitle>{t('Rename')}</DialogTitle>
            <Input
                required
                maxLength={120}
                autoFocus
                value={value}
                onChange={(event) => setValue(event.target.value)}
                aria-label={t('Title')}
            />
            <DialogFooter>
                <Button>{t('Save')}</Button>
            </DialogFooter>
        </form>
    );
}
```

If `DropdownMenuItem` in `resources/js/components/ui/dropdown-menu.tsx` has no `variant` prop, drop `variant="destructive"` and add `className="text-destructive"`.

```tsx
// resources/js/components/whiteboard/top-bar.tsx
import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { PresenceStrip } from '@/components/retro/presence-strip';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardState } from '@/hooks/use-whiteboard';

export function TopBar({
    state,
    children,
}: {
    state: WhiteboardState;
    children: ReactNode;
}) {
    const { t } = useTrans();
    const { board, links } = state.snapshot;

    return (
        <header className="flex items-center gap-3 border-b px-4 py-2">
            {links.team && (
                <Button asChild size="icon" variant="ghost">
                    <Link href={links.team} aria-label={t('Back to the team')}>
                        <ArrowLeft className="size-4" />
                    </Link>
                </Button>
            )}
            <h1 className="min-w-0 flex-1 truncate font-medium">
                {board.title}
            </h1>
            <PresenceStrip members={state.online} />
            {children}
        </header>
    );
}
```

- [ ] **Step 6: The board**

```tsx
// resources/js/components/whiteboard/board.tsx
import { usePage } from '@inertiajs/react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { ConnectionBanner } from '@/components/retro/connection-banner';
import { SessionExpiredBanner } from '@/components/retro/session-expired-banner';
import { useLocalPreference } from '@/hooks/use-local-preference';
import { useTrans } from '@/hooks/use-trans';
import { useWhiteboard } from '@/hooks/use-whiteboard';
import {
    Excalidraw,
    restoreElements,
    type ExcalidrawImperativeAPI,
} from '@/lib/whiteboard/excalidraw';
import { createSceneSync, type SceneSync } from '@/lib/whiteboard/scene-sync';
import type {
    RejectReason,
    SceneElement,
    WhiteboardSnapshot,
} from '@/lib/whiteboard/types';
import { BoardGone } from './board-gone';
import { BoardMenu } from './board-menu';
import { TopBar } from './top-bar';

const HideMyCursorKey = 'skrum.hideMyCursor';
const PollMs = 5000;

const ExcalidrawLocales: Record<string, string> = {
    en: 'en',
    fr: 'fr-FR',
    de: 'de-DE',
    es: 'es-ES',
};

function subscribeToTheme(onChange: () => void) {
    const observer = new MutationObserver(onChange);

    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
    });

    return () => observer.disconnect();
}

const isDark = () => document.documentElement.classList.contains('dark');

export default function Board({ snapshot }: { snapshot: WhiteboardSnapshot }) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const state = useWhiteboard(snapshot);
    const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
    const [offline, setOffline] = useState(false);
    const [hideMyCursor, setHideMyCursor] = useLocalPreference(
        HideMyCursorKey,
        false,
    );
    const sync = useRef<SceneSync | null>(null);
    const dark = useSyncExternalStore(subscribeToTheme, isDark, () => false);
    const boardId = snapshot.board.id;
    const { fail, listeners } = state;

    const rejectionMessages = useRef<Record<RejectReason, string>>({
        invalid: '',
        stale: '',
        locked: '',
        file: '',
        full: '',
    });

    rejectionMessages.current = {
        invalid: t('This element could not be saved.'),
        stale: '',
        locked: t('Only the facilitator can change a locked element.'),
        file: t('This image could not be added.'),
        full: t('This board is full.'),
    };

    useEffect(() => {
        if (!api) {
            return;
        }

        const created = createSceneSync({
            boardId,
            api,
            initial: snapshot,
            onFatal: fail,
            onRejected: (reason) =>
                toast.error(rejectionMessages.current[reason], { id: reason }),
            onOffline: setOffline,
        });

        sync.current = created;
        listeners.current = {
            onElementsChanged: created.handleRemote,
            onResync: () => void created.resync(),
            onLeaving: () => {},
        };

        return () => {
            created.dispose();
            sync.current = null;
            listeners.current = null;
        };
        // The snapshot only seeds the sync; later scenes come through it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [api, boardId, fail, listeners]);

    useEffect(() => {
        if (state.connected || state.status !== 'active') {
            return;
        }

        const poll = setInterval(() => void sync.current?.resync(), PollMs);

        return () => clearInterval(poll);
    }, [state.connected, state.status]);

    if (state.status !== 'active') {
        return (
            <BoardGone
                reason={state.status}
                teamUrl={state.snapshot.links.team}
            />
        );
    }

    return (
        <div className="flex h-dvh flex-col">
            {state.sessionExpired && <SessionExpiredBanner />}
            <div
                className="flex min-h-0 flex-1 flex-col"
                inert={state.sessionExpired}
            >
                <TopBar state={state}>
                    <BoardMenu
                        state={state}
                        hideMyCursor={hideMyCursor}
                        onHideMyCursorChange={setHideMyCursor}
                    />
                </TopBar>
                <ConnectionBanner
                    reconnecting={state.reconnecting || offline}
                />
                <div className="min-h-0 flex-1">
                    <Excalidraw
                        excalidrawAPI={setApi}
                        initialData={{
                            elements: restoreElements(
                                snapshot.elements as never,
                                null,
                            ),
                        }}
                        onChange={(elements) =>
                            sync.current?.handleChange(
                                elements as unknown as SceneElement[],
                            )
                        }
                        langCode={ExcalidrawLocales[locale as string] ?? 'en'}
                        theme={dark ? 'dark' : 'light'}
                        UIOptions={{
                            canvasActions: {
                                loadScene: false,
                                saveToActiveFile: false,
                                toggleTheme: false,
                            },
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
```

Hide the library button with the way found in Task 1 Step 4 (a `UIOptions` key if one exists; otherwise one rule in `resources/css/app.css` targeting the trigger's class, with a comment naming the Excalidraw version it was checked against).

If the linter rejects the `eslint-disable-next-line` comment (this repo lints with `vp check`, not ESLint), remove the comment and instead keep the snapshot in a ref read inside the effect:

```tsx
    const initial = useRef(snapshot);
    // …inside the effect: initial: initial.current,
```

- [ ] **Step 7: The page — lazy chunk, skeleton, retry**

```tsx
// resources/js/pages/whiteboards/show.tsx
import { Head } from '@inertiajs/react';
import {
    Component,
    Suspense,
    lazy,
    useState,
    type ComponentType,
    type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardSnapshot } from '@/lib/whiteboard/types';

type Props = { snapshot: WhiteboardSnapshot };

type BoardComponent = ComponentType<Props>;

const loadBoard = () => import('@/components/whiteboard/board');

class ChunkBoundary extends Component<
    { fallback: ReactNode; children: ReactNode },
    { failed: boolean }
> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    render() {
        return this.state.failed ? this.props.fallback : this.props.children;
    }
}

function CanvasError({ onRetry }: { onRetry: () => void }) {
    const { t } = useTrans();

    return (
        <div className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
            <p>{t('The canvas could not be loaded.')}</p>
            <Button variant="outline" onClick={onRetry}>
                {t('Retry')}
            </Button>
        </div>
    );
}

export default function ShowWhiteboard({ snapshot }: Props) {
    const [attempt, setAttempt] = useState(0);
    const [Board, setBoard] = useState<BoardComponent>(() => lazy(loadBoard));

    const retry = () => {
        setBoard(() => lazy(loadBoard));
        setAttempt((current) => current + 1);
    };

    return (
        <>
            <Head title={snapshot.board.title} />
            <ChunkBoundary
                key={attempt}
                fallback={<CanvasError onRetry={retry} />}
            >
                <Suspense fallback={<Skeleton className="h-dvh w-full" />}>
                    <Board snapshot={snapshot} />
                </Suspense>
            </ChunkBoundary>
        </>
    );
}
```

- [ ] **Step 8: Add the translation keys of this task** (Appendix A, rows marked 9).

- [ ] **Step 9: Verify statically**

Run: `npm run build && npm run types:check && npm run check && php artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: all PASS.

Then confirm the library is not in the shared bundle:

Run: `grep -l "excalidraw" public/build/assets/*.js | wc -l` and `grep -c "excalidraw" public/build/assets/app-*.js`
Expected: the first lists a few chunk files; the second prints `0` for the app entry chunk (a reference to a chunk *file name* containing "excalidraw" is acceptable; library code is not).

- [ ] **Step 10: Verify in two browsers**

Run `composer run dev`. Browser A: log in, create a whiteboard from the team page. Browser B (another user of the team, or a private window after enabling guest access and opening the guest link).

Check, and fix before committing if any fails:
1. A draws a rectangle → B sees it without reloading.
2. B moves it → A sees the move.
3. A and B drag the same rectangle and release → both show the same position.
4. A pastes a PNG → B sees the image.
5. A reloads → scene identical.
6. A goes offline (devtools), draws, goes online → B receives the drawing; banner shows then clears.
7. Stop Reverb (`Ctrl+C` its process), A draws → B gets it within about 5 s (polling).
8. Facilitator renames the board → the other browser's title changes.
9. Facilitator deletes the board → the other browser shows "This board was deleted."

- [ ] **Step 11: Commit**

```bash
git add resources lang
git commit -m "feat(whiteboard): the board page with a live excalidraw canvas"
```

---

### Task 10: Sticky notes and cursors

**Files:**
- Create: `resources/js/components/whiteboard/sticky-tool.tsx`, `resources/js/hooks/use-whiteboard-cursors.ts`
- Modify: `resources/js/components/whiteboard/board.tsx`

**Interfaces:**
- Consumes: `whisperTransport`, `WhisperChannel` from `@/lib/realtime/whisper-transport`; `WhiteboardState.presence`, `.online`, `.listeners`; `ExcalidrawImperativeAPI`; the server's sticky flag (Task 6: `customData.skrum.kind === 'sticky'` on a rectangle).
- Produces: `<StickyTool api />`; `useWhiteboardCursors({ api, presence, online, meId, enabled, hidden }): { onPointerUpdate(payload: { pointer: { x: number; y: number } }): void; forget(memberId: string): void }`.

- [ ] **Step 1: Sticky tool**

```tsx
// resources/js/components/whiteboard/sticky-tool.tsx
import { StickyNote } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import {
    CaptureUpdateAction,
    restoreElements,
    type ExcalidrawImperativeAPI,
} from '@/lib/whiteboard/excalidraw';

const Size = 200;

export const StickyColors = [
    '#fff3bf',
    '#ffd8a8',
    '#ffc9c9',
    '#d0bfff',
    '#a5d8ff',
    '#b2f2bb',
] as const;

function randomInteger(): number {
    return Math.floor(Math.random() * 2 ** 31);
}

function randomId(): string {
    return crypto.randomUUID().replaceAll('-', '').slice(0, 20);
}

/** A sticky note is a rectangle the server recognises by its marker (spec §6.1). */
function stickyAt(x: number, y: number, color: string) {
    return {
        id: randomId(),
        type: 'rectangle',
        x,
        y,
        width: Size,
        height: Size,
        angle: 0,
        strokeColor: 'transparent',
        backgroundColor: color,
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: randomInteger(),
        version: 1,
        versionNonce: randomInteger(),
        isDeleted: false,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false,
        customData: { skrum: { kind: 'sticky' } },
    };
}

export function StickyTool({ api }: { api: ExcalidrawImperativeAPI }) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);

    const add = (color: string) => {
        const { scrollX, scrollY, zoom, width, height } = api.getAppState();
        const x = width / 2 / zoom.value - scrollX - Size / 2;
        const y = height / 2 / zoom.value - scrollY - Size / 2;
        const sticky = stickyAt(x, y, color);
        const [restored] = restoreElements([sticky] as never, null);

        api.updateScene({
            elements: [...api.getSceneElementsIncludingDeleted(), restored],
            appState: { selectedElementIds: { [sticky.id]: true } } as never,
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
        setOpen(false);
    };

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                    <StickyNote className="size-4" />
                    {t('Sticky note')}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="flex gap-1 p-2">
                {StickyColors.map((color) => (
                    <button
                        key={color}
                        type="button"
                        className="size-7 rounded border"
                        style={{ backgroundColor: color }}
                        aria-label={t('Add a sticky note')}
                        onClick={() => add(color)}
                    />
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
```

`CaptureUpdateAction.IMMEDIATELY` makes the insertion undoable with Ctrl+Z; `restoreElements` fills `index` and any field the pinned version requires. The user types by double-clicking the note (Excalidraw creates the bound text). The new element reaches the server through the normal `onChange` path.

- [ ] **Step 2: Cursor hook**

```ts
// resources/js/hooks/use-whiteboard-cursors.ts
import { useEffect, useMemo, useRef } from 'react';
import {
    whisperTransport,
    type WhisperChannel,
} from '@/lib/realtime/whisper-transport';
import type { PresenceMember } from '@/lib/retro/types';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';

const SendEveryMs = 40;
const TimeToLiveMs = 3000;
const SweepEveryMs = 1000;
const MaxCursors = 50;

type CursorMessage = { x: number; y: number };

type RemoteCursor = CursorMessage & { seenAt: number };

type Options = {
    api: ExcalidrawImperativeAPI | null;
    presence: WhisperChannel | null;
    online: PresenceMember[];
    meId: string;
    /** The board's switch: off removes cursors for everyone. */
    enabled: boolean;
    /** The person's own preference: others stop seeing this cursor. */
    hidden: boolean;
};

function isCursorMessage(raw: unknown): raw is CursorMessage {
    if (typeof raw !== 'object' || raw === null) {
        return false;
    }

    const { x, y } = raw as Record<string, unknown>;

    return (
        typeof x === 'number' &&
        typeof y === 'number' &&
        Number.isFinite(x) &&
        Number.isFinite(y)
    );
}

function colorFor(memberId: string): { background: string; stroke: string } {
    let hash = 0;

    for (const character of memberId) {
        hash = (hash * 31 + character.charCodeAt(0)) % 360;
    }

    return {
        background: `hsl(${hash} 70% 45%)`,
        stroke: `hsl(${hash} 70% 30%)`,
    };
}

export function useWhiteboardCursors({
    api,
    presence,
    online,
    meId,
    enabled,
    hidden,
}: Options) {
    const cursors = useRef(new Map<string, RemoteCursor>());
    const roster = useRef(online);
    const lastSent = useRef(0);

    roster.current = online;

    const transport = useMemo(() => {
        if (!presence || !enabled) {
            return null;
        }

        return whisperTransport(
            presence,
            'cursor',
            (senderId, raw) =>
                senderId !== meId &&
                roster.current.some((member) => member.id === senderId) &&
                isCursorMessage(raw),
        );
    }, [presence, enabled, meId]);

    useEffect(() => {
        if (!api) {
            return;
        }

        const known = cursors.current;

        const render = () => {
            const collaborators = new Map(
                [...known].map(([memberId, cursor]) => [
                    memberId,
                    {
                        id: memberId,
                        username:
                            roster.current.find(
                                (member) => member.id === memberId,
                            )?.name ?? '',
                        color: colorFor(memberId),
                        pointer: { x: cursor.x, y: cursor.y, tool: 'pointer' },
                    },
                ]),
            );

            api.updateScene({ collaborators: collaborators as never });
        };

        if (!transport) {
            known.clear();
            render();

            return;
        }

        const stop = transport.onMessage((raw, senderId) => {
            if (!senderId) {
                return;
            }

            if (!known.has(senderId) && known.size >= MaxCursors) {
                return;
            }

            known.set(senderId, { ...(raw as CursorMessage), seenAt: Date.now() });
            render();
        });

        const sweep = setInterval(() => {
            const deadline = Date.now() - TimeToLiveMs;
            let changed = false;

            for (const [memberId, cursor] of known) {
                if (cursor.seenAt < deadline) {
                    known.delete(memberId);
                    changed = true;
                }
            }

            if (changed) {
                render();
            }
        }, SweepEveryMs);

        return () => {
            stop();
            clearInterval(sweep);
            known.clear();
            render();
        };
    }, [api, transport]);

    return {
        onPointerUpdate({ pointer }: { pointer: { x: number; y: number } }) {
            if (!transport || hidden) {
                return;
            }

            const now = Date.now();

            if (now - lastSent.current < SendEveryMs) {
                return;
            }

            lastSent.current = now;
            transport.send({ x: pointer.x, y: pointer.y });
        },
        forget(memberId: string) {
            if (!cursors.current.delete(memberId) || !api) {
                return;
            }

            api.updateScene({
                collaborators: new Map(
                    [...cursors.current].map(([id, cursor]) => [
                        id,
                        {
                            id,
                            username:
                                roster.current.find((member) => member.id === id)
                                    ?.name ?? '',
                            color: colorFor(id),
                            pointer: {
                                x: cursor.x,
                                y: cursor.y,
                                tool: 'pointer',
                            },
                        },
                    ]),
                ) as never,
            });
        },
    };
}
```

The sender id is the presence id stamped by Reverb (see the comment in `whisper-transport.ts`), never a field of the message; the `accept` callback drops anyone outside the roster.

- [ ] **Step 3: Wire both into the board**

In `resources/js/components/whiteboard/board.tsx`:

Import `StickyTool` and `useWhiteboardCursors`. After the `sync` ref:

```tsx
    const cursors = useWhiteboardCursors({
        api,
        presence: state.presence,
        online: state.online,
        meId: state.snapshot.me.id,
        enabled: state.snapshot.board.cursorsEnabled,
        hidden: hideMyCursor,
    });
    const forgetCursor = useRef(cursors.forget);

    forgetCursor.current = cursors.forget;
```

In the sync effect, replace `onLeaving: () => {},` with:

```tsx
            onLeaving: (member) => forgetCursor.current(member.id),
```

On `<Excalidraw>`, add:

```tsx
                        onPointerUpdate={cursors.onPointerUpdate}
```

Inside `<TopBar>`, before `<BoardMenu …/>`:

```tsx
                    {api && <StickyTool api={api} />}
```

- [ ] **Step 4: Add the translation keys of this task** (Appendix A, rows marked 10).

- [ ] **Step 5: Verify statically**

Run: `npm run build && npm run types:check && npm run check && php artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: all PASS.

- [ ] **Step 6: Verify in two browsers**

1. A clicks "Sticky note", picks a colour → a note appears at the centre of A's view, selected; B sees it.
2. A double-clicks it and types → B sees the text after A stops typing.
3. In the database: `select element_id, is_sticky from whiteboard_elements where is_sticky` (Boost `database-query`) returns the rectangle, not its text.
4. A moves the pointer → B sees a named cursor that follows pan and zoom correctly; it disappears about 3 s after A stops, and at once when A closes the tab.
5. A ticks "Hide my cursor" → B no longer sees A's cursor; A still sees B's.
6. Facilitator unticks "Show live cursors" → nobody sees any cursor.

- [ ] **Step 7: Commit**

```bash
git add resources lang
git commit -m "feat(whiteboard): sticky notes and live cursors on the canvas"
```

---

### Task 11: Walkthrough, latency measure, full verification

**Files:**
- Create: `docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md`
- Modify: `docs/superpowers/specs/2026-10-01-whiteboard-design.md` (§18, and §6.4 only if Step 2 says so)

**Interfaces:**
- Consumes: everything above.
- Produces: a walkthrough a human (or the plan 16 browser harness) can replay; a decision on drafts.

- [ ] **Step 1: Write the walkthrough**

Create `docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md` (create the folder if plan 16 has not yet) with one numbered section per acceptance criterion of spec §16 "Core (R1–R4)", each as *setup → action → expected*. Use exactly these nine sections, in this order:

1. Create from the team page → lands on the board as facilitator; board listed on the team page.
2. Member + guest in two browsers: sticky note, shape, connector, drawing, image each appear on the other side within 1 s.
3. Both drag the same element and release → same final position on both.
4. Reload → identical scene.
5. Offline edits replay on reconnect; the other side's edits arrive.
6. Guest access off → guest link shows "This guest link is no longer valid."; logged-in non-member gets 403 on the board URL.
7. Regenerate the guest link → the previous guest's next action shows the session-ended state.
8. Tampering (run in the browser console of a member): `fetch` a `PUT elements` with a forged `authorMemberId`, an `iframe` type, a `javascript:` link; upload an SVG → none is stored (check with `database-query`).
9. Full board: covered by `WhiteboardElementWritesTest` ("refuses new elements on a full board"); state that it is not replayed by hand.

- [ ] **Step 2: Measure whether drafts are needed (spec §6.4, §18)**

With two browsers on the same machine, open devtools → Network on A, drag a rectangle steadily for about 10 s, and read the `elements` requests: note how often they fire and their duration. On B, judge whether the movement looks continuous.

- If B updates at least about three times per second and each request completes in under 300 ms: drafts are not needed. In the spec, replace the "Drafts" bullet of §6.4 with "**Drafts:** not built. Intermediate states of a drag or stroke already travel in the 300 ms write batches (measured in plan 17a: {your numbers})." and remove the second open question of §18.
- Otherwise: leave the spec unchanged and report the numbers; drafts become their own plan.

- [ ] **Step 3: Run the walkthrough** sections 1–8 by hand and tick each in the file. Fix anything that fails (spec first if the spec is wrong), with a test where a server rule was missing.

- [ ] **Step 4: Full verification**

Run each and read the output:

```bash
vendor/bin/pint --dirty --format agent
php artisan test --compact tests/Feature/Whiteboards
composer lint
npm run build && npm run types:check && npm run check
```

Expected: every command exits 0. Then ask the user to run the complete suite with `php artisan test --compact`.

- [ ] **Step 5: Commit**

```bash
git add docs
git commit -m "docs(whiteboard): walkthrough for the whiteboard core and the drafts decision"
```

---

## Appendix A — Translation keys

Add each key to `lang/en.json` (value = key), `lang/fr.json`, `lang/de.json`, `lang/es.json`, keeping each file's alphabetical order. Keys marked "exists" are already present; do not duplicate them. The "Task" column says where the key is first used.

| Task | Key (English) | French | German | Spanish |
|---|---|---|---|---|
| 3 | You no longer have access to this board. | Vous n'avez plus accès à ce tableau. | Sie haben keinen Zugriff mehr auf dieses Board. | Ya no tienes acceso a esta pizarra. |
| 3 | Only the facilitator or a workspace admin can delete this board. | Seul l'animateur ou un administrateur de l'espace peut supprimer ce tableau. | Nur der Moderator oder ein Workspace-Admin kann dieses Board löschen. | Solo el facilitador o un administrador del espacio puede eliminar esta pizarra. |
| 3 | Your session has expired. | exists | exists | exists |
| 3 | Only the facilitator can do this. | exists | exists | exists |
| 4 | The facilitator must be a member of this team. | exists | exists | exists |
| 4 | Join a whiteboard | Rejoindre un tableau blanc | Einem Whiteboard beitreten | Unirse a una pizarra |
| 4 | Choose the name other participants will see. | Choisissez le nom que les autres participants verront. | Wählen Sie den Namen, den die anderen Teilnehmenden sehen. | Elige el nombre que verán los demás participantes. |
| 4 | This guest link is no longer valid. | exists | exists | exists |
| 4 | Display name | exists | exists | exists |
| 4 | Join | exists | exists | exists |
| 6 | This board changed too much. Reloading it. | Ce tableau a trop changé. Rechargement en cours. | Dieses Board hat sich zu stark geändert. Es wird neu geladen. | Esta pizarra ha cambiado demasiado. Se está recargando. |
| 7 | Only PNG, JPEG, WebP and GIF images can be added. | Seules les images PNG, JPEG, WebP et GIF peuvent être ajoutées. | Nur PNG-, JPEG-, WebP- und GIF-Bilder können hinzugefügt werden. | Solo se pueden añadir imágenes PNG, JPEG, WebP y GIF. |
| 7 | This board has reached its image storage limit. | Ce tableau a atteint sa limite de stockage d'images. | Dieses Board hat sein Speicherlimit für Bilder erreicht. | Esta pizarra ha alcanzado su límite de almacenamiento de imágenes. |
| 8 | Whiteboards | Tableaux blancs | Whiteboards | Pizarras |
| 8 | New whiteboard | Nouveau tableau blanc | Neues Whiteboard | Nueva pizarra |
| 8 | No whiteboards yet. | Aucun tableau blanc pour l'instant. | Noch keine Whiteboards. | Aún no hay pizarras. |
| 8 | Facilitated by :name | Animé par :name | Moderiert von :name | Facilitado por :name |
| 8 | Title | check, add if missing: Titre | Titel | Título |
| 8 | Create | check, add if missing: Créer | Erstellen | Crear |
| 9 | This board was deleted. | Ce tableau a été supprimé. | Dieses Board wurde gelöscht. | Esta pizarra fue eliminada. |
| 9 | Your access to this board has ended. | Votre accès à ce tableau a pris fin. | Ihr Zugriff auf dieses Board ist beendet. | Tu acceso a esta pizarra ha terminado. |
| 9 | Back to the team | exists | exists | exists |
| 9 | The canvas could not be loaded. | Le canevas n'a pas pu être chargé. | Die Zeichenfläche konnte nicht geladen werden. | No se pudo cargar el lienzo. |
| 9 | Retry | check, add if missing: Réessayer | Erneut versuchen | Reintentar |
| 9 | Board menu | Menu du tableau | Board-Menü | Menú de la pizarra |
| 9 | Hide my cursor | exists | exists | exists |
| 9 | Take control | check, add if missing: Prendre le contrôle | Kontrolle übernehmen | Tomar el control |
| 9 | Rename | check, add if missing: Renommer | Umbenennen | Renombrar |
| 9 | Show live cursors | check, add if missing: Afficher les curseurs en direct | Live-Cursor anzeigen | Mostrar cursores en vivo |
| 9 | Allow guests to join with a link | Autoriser les invités à rejoindre avec un lien | Gästen den Beitritt per Link erlauben | Permitir que los invitados se unan con un enlace |
| 9 | Replace the guest link | Remplacer le lien d'invitation | Gast-Link ersetzen | Reemplazar el enlace de invitado |
| 9 | Copy the guest link | Copier le lien d'invitation | Gast-Link kopieren | Copiar el enlace de invitado |
| 9 | Link copied. | check, add if missing: Lien copié. | Link kopiert. | Enlace copiado. |
| 9 | Delete this board | Supprimer ce tableau | Dieses Board löschen | Eliminar esta pizarra |
| 9 | Delete this board? | Supprimer ce tableau ? | Dieses Board löschen? | ¿Eliminar esta pizarra? |
| 9 | Everything on it is removed for everyone. | Tout son contenu est supprimé pour tout le monde. | Alle Inhalte werden für alle entfernt. | Todo su contenido se elimina para todos. |
| 9 | Cancel | exists | exists | exists |
| 9 | Save | exists | exists | exists |
| 9 | This element could not be saved. | Cet élément n'a pas pu être enregistré. | Dieses Element konnte nicht gespeichert werden. | No se pudo guardar este elemento. |
| 9 | Only the facilitator can change a locked element. | Seul l'animateur peut modifier un élément verrouillé. | Nur der Moderator kann ein gesperrtes Element ändern. | Solo el facilitador puede modificar un elemento bloqueado. |
| 9 | This image could not be added. | Cette image n'a pas pu être ajoutée. | Dieses Bild konnte nicht hinzugefügt werden. | No se pudo añadir esta imagen. |
| 9 | This board is full. | Ce tableau est plein. | Dieses Board ist voll. | Esta pizarra está llena. |
| 10 | Sticky note | Post-it | Haftnotiz | Nota adhesiva |
| 10 | Add a sticky note | Ajouter un post-it | Haftnotiz hinzufügen | Añadir una nota adhesiva |

For every row marked "exists" or "check", run `grep -n '"<key>"' lang/fr.json` first; reuse the existing translation when the key is there. `tests/Feature/TranslationKeysTest.php` is the judge.
