# Whiteboard Secrecy and History (Plan 17d) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A facilitator runs a silent-writing round in which nobody, the facilitator included, receives the text of another person's sticky note before the reveal, and any member brings back an earlier state of the board from automatic or named versions.

**Architecture:** Privacy is a column on the element row (`is_private`), set by the write path while the board's `private_writing` switch is on and cleared only by the reveal. `PresentWhiteboardElement`, already the only serializer of an element, masks a private row for every viewer but its author; a write that touches a private row is broadcast without elements, so each client fetches its own copy. The write path refuses, with reason `private`, anything another member does to a private row or to its binding. A version is a row holding the live scene as stored (real text); a queued job stores one five minutes after the first change that follows the last version. Restore rewrites the board from a version inside the board lock, as ordinary element rows with higher versions, so clients converge through the normal delta.

**Tech Stack:** Laravel 13, PHP 8.4, PostgreSQL, Pest 5, queue worker, Reverb, Inertia 3 + React 19, Wayfinder, `@excalidraw/excalidraw` 0.18.1 (only through `resources/js/lib/whiteboard/excalidraw.ts`).

**Spec:** `docs/superpowers/specs/2026-10-01-whiteboard-design.md` — this plan covers R9 and R10: §11.5, §9, the columns and table of §7 they need (`private_writing`, `is_private`, `last_versioned_seq`, `whiteboard_versions`), version ownership of files in §6.5, the versions rows and the `privateWriting` settings key of §12, the history panel and masked-note marks of §13, and "Private writing" and "Version history" of §16. Read it and `.superpowers/sdd/whiteboard-rules.md` before starting. The spec was edited with this plan (list at the end, "Spec edits made with this plan").

**Written in advance.** This plan was written in a separate worktree at commit `e0524df` (plan 17b Tasks 1–7 merged, Task 8 in progress, Task 9 not started) while plan 17c was being written in parallel and could not be read. Everything that touches 17c is isolated in steps titled **"17c step"** and listed in the last section, "Assumptions to reconcile". Read that section before Task 1.

**How the code here was checked:** nothing in this plan was run: the worktree had no `vendor/` and no `node_modules/`. Every PHP signature, helper and test idiom was read in the repository at `e0524df`, and every canvas name in `node_modules/@excalidraw/excalidraw/dist` (files cited where used). Test code is complete and is the specification; implementation code is a proposal (rule 2 of the implementers' rules applies: fix the smallest thing that makes the tests and the spec true, and report it).

## Global Constraints

- No new dependency, PHP or JS. No JavaScript test runner: client logic stays thin, rules live on the server.
- Every primary and foreign key is a UUID (`tests/Feature/UuidPrimaryKeysTest.php`). Migrations have `up` only. This plan's migration is dated `2026_10_12_100000`, after every whiteboard migration of 17a–17c.
- Request bodies are snake_case (`private_writing`); Excalidraw elements keep camelCase. Route names are camelCase segments, URLs kebab-case, controllers plural with CRUD method names, one controller per non-CRUD action.
- Every UI string goes through `__()` / `t()` with its key in `lang/en.json`, `fr.json`, `de.json`, `es.json` (`tests/Feature/TranslationKeysTest.php`). Each task lists the keys it adds, with translations. `lang/*.json` are not sorted: append.
- The board UI never names the canvas library and shows none of its branding; overlays never cover canvas controls, the reactions bar or the shapes toolbar.
- **The secrecy invariant (spec §11.5):** the text of another member's private sticky never leaves the server — snapshot, Inertia page, `GET elements`, `rejected` copies, `elements.changed`, versions, duplicate, template, log lines — for the facilitator too. Every test of a surface uses `whiteboardPayloadExposes()` (Task 1). No code in this plan passes an element, a scene or a version to `Log::`, to an exception message or to a broadcast.
- All element payloads leave the server through `PresentWhiteboardElement`. Raw `data` is only read by server-side copies (`ReadWhiteboardScene`, versions, restore), each of which checks `WhiteboardGuard::notPrivateWriting` inside the board lock when its output can reach a client.
- Every mutation: resolve member → guard → transaction with `lockForUpdate` on the board row → re-check inside the lock → broadcast with `sendToOthers()` (which already waits for the commit, `app/Events/Concerns/SendsToOthers.php`).
- Anything the server writes as an element passes `SanitizeWhiteboardElement` and keeps valid fractional indices.
- The board's `updated_at` is the sort key of the team page: bookkeeping columns (`last_versioned_seq`) are written through the base query (`->toBase()->update()`), as `PurgeWhiteboardTombstones` does.
- Limits from the spec: version name 1–80; 100 named versions per board; 50 automatic versions kept; one automatic version at most every 5 minutes; messages "Reveal the notes first." and "This board already has 100 saved versions.".
- The test environment runs queued jobs synchronously (`phpunit.xml`: `QUEUE_CONNECTION=sync`), ignoring delays. A test file that writes elements and counts versions calls `Queue::fake()`.
- PHP: early returns, no `else`, braces always, typed everything, no comment that restates code. `vendor/bin/pint --dirty --format agent` and `vendor/bin/phpstan analyse --memory-limit=1G <touched php files>` before each commit.
- Frontend: URLs only through Wayfinder (`@/actions/...`); `npm run build`, then `npm run types:check` (one known error in `resources/js/components/manage-passkeys.tsx` is not yours) and `npx vp check <files you touched>`. Leave `public/build` fresh.
- Tests: `DB_HOST=127.0.0.1 php artisan test --compact <paths>`. After the migration also run `vendor/bin/sail artisan migrate --no-interaction`.
- Git: `git add` explicit paths only; never stage `.junie/mcp/mcp.json`; every commit ends with the trailer of `.superpowers/sdd/whiteboard-rules.md`.

## Review Focus

1. **A member holds a masked note and their canvas sends it back** — unchanged (a retry), edited (they dragged or typed on it), deleted (eraser, "clear canvas"), with a lower nonce, or as the facilitator. The author's text must survive every one of them and the sender's canvas must return to the masked copy. Pinned in Task 2: "refuses every change another member makes to a private note and keeps the text".
2. **The text of a note reaches the server without its container** (the container was rejected, or the batch was split between the two) while private writing is on. It must not be broadcast or served in clear. Pinned in Task 2: "treats a bound text whose container is unknown as private while private writing is on".
3. **The database refuses a statement that carries note text** (deadlock, constraint, lost connection). Laravel's `QueryException` message contains the statement with its bindings, and PostgreSQL adds the failing row: the report must hold neither. Pinned in Task 2: "keeps the text of a note out of the log, even when the database refuses the write", and in Task 4: "keeps the scene out of the log when a version cannot be stored".
4. **The automatic-version job is lost, or never due** (worker restarted mid-job, failed job, a board created from a template whose `seq` starts above zero). Versions must start again by themselves. Pinned in Task 4: "queues the versions a lost job never stored" and "schedules the first version of a board created from a scene".
5. **Restore meets an element it cannot simply rewrite**: its row is gone (tombstone purged) while a browser left open still holds that tombstone at a higher version, or a client pushed it to the highest version number. Restore must bring the element back where it can, leave the rest of the board restored, and never answer 500. Pinned in Task 6: "brings back an element whose row is gone under a fresh id" and "restores the rest when an element sits at the highest version number".

---

## File Structure

Backend (new unless marked):

| Path | Responsibility |
|---|---|
| `database/migrations/2026_10_12_100000_add_private_writing_and_versions_to_whiteboards.php` | Two board columns, `is_private`, `whiteboard_versions` |
| `app/Models/WhiteboardVersion.php`, `database/factories/WhiteboardVersionFactory.php` | Version model |
| `app/Models/Whiteboard.php`, `WhiteboardElement.php`, `database/factories/WhiteboardFactory.php` (modify) | New columns, `versions()`, `privateWriting()` state |
| `app/Actions/Whiteboards/BuildWhiteboardSnapshot.php` (modify) | `board.privateWriting` |
| `app/Actions/Whiteboards/CopyWhiteboardScene.php` (modify) | A new board starts with nothing left to version |
| `app/Actions/Whiteboards/PresentWhiteboardElement.php` (modify) | Masking |
| `app/Actions/Whiteboards/WriteWhiteboardElements.php` (modify) | Privacy flag, reason `private`, ids-only broadcast, version scheduling |
| `app/Actions/Whiteboards/KeepWhiteboardTextOutOfLogs.php`, `app/Exceptions/WhiteboardQueryFailed.php` | Database failures reported without bindings |
| `app/Actions/Whiteboards/WhiteboardGuard.php` (modify) | `notPrivateWriting` |
| `app/Actions/Whiteboards/SetWhiteboardPrivateWriting.php` | Switch on; reveal |
| `app/Http/Controllers/Whiteboards/WhiteboardSettingsController.php` (modify) | `private_writing` key |
| `app/Actions/Whiteboards/DuplicateWhiteboard.php`, `SaveWhiteboardTemplate.php` (modify) | Blocked while private writing is on |
| `app/Actions/Whiteboards/StoreWhiteboardVersion.php` | Live scene → version row; retention |
| `app/Actions/Whiteboards/ScheduleWhiteboardVersion.php` | First change after the last version → delayed job |
| `app/Jobs/StoreAutomaticWhiteboardVersion.php` | The delayed job |
| `app/Actions/Whiteboards/QueueMissedWhiteboardVersions.php`, `app/Console/Commands/PruneWhiteboardsCommand.php` (modify) | Daily catch-up |
| `app/Actions/Whiteboards/PruneWhiteboardFiles.php` (modify) | A version keeps its images alive |
| `app/Actions/Whiteboards/PresentWhiteboardVersion.php` | List item of a version |
| `app/Http/Controllers/Whiteboards/WhiteboardVersionsController.php` | index, store, show, update, destroy |
| `app/Actions/Whiteboards/RestoreWhiteboardVersion.php`, `app/Http/Controllers/Whiteboards/WhiteboardVersionRestoresController.php` | Restore |
| `app/Actions/Whiteboards/CopyWhiteboardVersion.php`, `app/Http/Controllers/Whiteboards/WhiteboardVersionCopiesController.php` | Copy to a new board |
| `routes/web.php` (modify) | Seven routes |
| `tests/Pest.php` (modify) | Helpers shared by the test files below |

Frontend (new unless marked):

| Path | Responsibility |
|---|---|
| `resources/js/lib/whiteboard/types.ts`, `excalidraw.ts` (modify) | `privateWriting`, reason `private`, version types, API members used |
| `resources/js/components/whiteboard/private-writing-banner.tsx` | Banner and "Reveal the notes" |
| `resources/js/components/whiteboard/masked-notes.tsx` | "•••" marks above masked notes |
| `resources/js/components/whiteboard/history-panel.tsx`, `version-preview.tsx` | History panel, read-only preview |
| `resources/js/components/whiteboard/board.tsx`, `board-menu.tsx`, `top-bar.tsx` (modify) | Switch, banner, overlay, history button, resync on reveal |

Shared shapes used by several tasks:

```
VersionScene   = array{elements: list<array<string, mixed>>, fileIds: list<string>}      (whiteboard_versions.scene)
VersionSummary = array{id: string, name: ?string, createdAt: string, createdByName: ?string, automatic: bool}
Scene          = array{elements: list<array<string, mixed>>, files: list<SceneFile>}     (CopyWhiteboardScene, unchanged)
```

Wire shape of a private note, for a viewer who is not its author (spec §11.5):

```
the note (rectangle)  = stored data, with customData = {skrum: {kind: 'sticky', masked: true}}
its bound text        = stored data, with text = '' and originalText = ''
both keep the stored id, index, version, versionNonce, isDeleted, position and size
```

Why this shape is safe on the client, checked in the library and in plan 17a's code:

- `restoreElements` marks a non-deleted text whose `text` is empty as deleted and bumps its version (`node_modules/@excalidraw/excalidraw/dist/dev/chunk-4FTI6OG3.js`, lines 20529–20532: `if (!text && !element.isDeleted) { element = {...element, originalText: text, isDeleted: true}; element = bumpVersion(element); }`). `resources/js/lib/whiteboard/restore.ts` (`withServerVersions`) then puts the server's `version` and `versionNonce` back. So a client holds a masked text as a locally deleted text whose stamp equals the one `scene-sync.ts` recorded in `known`: `handleChange` skips it (`seen === stamp(element)`), and it is never written back.
- Because the bound text is deleted locally, the canvas draws the note empty; the "•••" mark is skrum's overlay (Task 7).
- `reconcileElements` keeps the local copy only when it is being edited, has a higher version, or has the same version and a **lower** nonce (`dist/dev/index.js`, lines 32828–32837, `shouldDiscardRemoteElement`). After the reveal the real copy arrives with the same version and the same nonce as the masked one, so it replaces it. The reveal therefore changes no version: it only gives the revealed rows a new `seq` so that `GET elements?since=` returns them.
- If the canvas does change a masked copy (drag, erase, typing creates a new bound text), the write is refused with reason `private` and `scene-sync.ts` forces the server's masked copy back (`settle` → `force`), or drops the element the server never had (`dropLocally`).

---

### Task 1: Columns, the version table, models, the snapshot flag

**Files:**
- Create: `database/migrations/2026_10_12_100000_add_private_writing_and_versions_to_whiteboards.php`, `app/Models/WhiteboardVersion.php`, `database/factories/WhiteboardVersionFactory.php`
- Modify: `app/Models/Whiteboard.php`, `app/Models/WhiteboardElement.php`, `database/factories/WhiteboardFactory.php`, `app/Actions/Whiteboards/BuildWhiteboardSnapshot.php`, `app/Actions/Whiteboards/CopyWhiteboardScene.php`, `tests/Pest.php`
- Test: `tests/Feature/Whiteboards/WhiteboardSecrecyModelTest.php`

**Interfaces:**
- Consumes: `Whiteboard`, `WhiteboardElement`, `WhiteboardMember`, `BuildWhiteboardSnapshot::handle(Whiteboard, WhiteboardMember): array`, `CopyWhiteboardScene::handle(Whiteboard, WhiteboardMember, array $scene): void`, test helpers `whiteboardMember`, `whiteboardFacilitator`, `whiteboardGuest`, `whiteboardGuestCookie`, `sceneElement` (`tests/Pest.php`).
- Produces:
  - Columns `whiteboards.private_writing` (bool, default false), `whiteboards.last_versioned_seq` (unsigned bigint, default 0), `whiteboard_elements.is_private` (bool, default false); table `whiteboard_versions`.
  - `Whiteboard::$private_writing: bool`, `Whiteboard::$last_versioned_seq: int`, `Whiteboard::versions(): HasMany<WhiteboardVersion>`; factory state `Whiteboard::factory()->privateWriting()`.
  - `WhiteboardElement::$is_private: bool` (fillable, cast).
  - `WhiteboardVersion` (`id`, `whiteboard_id`, `name: ?string`, `scene: VersionScene`, `seq: int`, `created_by_member_id: ?string`, `created_at`; no `updated_at`), constants `WhiteboardVersion::MaxNamed = 100`, `WhiteboardVersion::KeptAutomatic = 50`, `isAutomatic(): bool`, `createdBy(): BelongsTo<WhiteboardMember>`, `whiteboard(): BelongsTo<Whiteboard>`; factory state `->named(string $name = 'Checkpoint')`.
  - Snapshot key `board.privateWriting: bool`.
  - A board filled by `CopyWhiteboardScene` has `last_versioned_seq === seq`.
  - Test helpers in `tests/Pest.php`: `stickyWithText(string $id, string $text): array{0: array, 1: array}`, `storeWhiteboardElement(Whiteboard $board, array $data, int $seq, ?WhiteboardMember $author = null, bool $private = false): WhiteboardElement`, `putWhiteboardElements(mixed $test, Whiteboard $board, array $elements): TestResponse`, `whiteboardViewer(mixed $test, User|WhiteboardMember $viewer): mixed`, `whiteboardPayloadExposes(mixed $payload, string $secret): bool`, `privateWritingBoard(): array{board: Whiteboard, facilitator: User, author: User, authorMember: WhiteboardMember, other: User, otherMember: WhiteboardMember, guest: WhiteboardMember, secret: string}`.

- [ ] **Step 1: Add the shared test helpers**

Append to `tests/Pest.php`, after `sceneElement()`. Add `use App\Models\WhiteboardElement;` to the imports (the others used here — `User`, `Whiteboard`, `WhiteboardMember`, `TestResponse` — are already imported; check with `grep -n '^use' tests/Pest.php`).

```php
/**
 * A sticky note and its bound text, as the canvas writes them.
 *
 * @return array{0: array<string, mixed>, 1: array<string, mixed>}
 */
function stickyWithText(string $id, string $text): array
{
    return [
        sceneElement([
            'id' => $id,
            'index' => 'a1',
            'backgroundColor' => '#fff3bf',
            'customData' => ['skrum' => ['kind' => 'sticky']],
            'boundElements' => [['id' => "{$id}-text", 'type' => 'text']],
        ]),
        sceneElement([
            'id' => "{$id}-text",
            'type' => 'text',
            'index' => 'a2',
            'text' => $text,
            'originalText' => $text,
            'containerId' => $id,
        ]),
    ];
}

/**
 * Stores an element row as the write path would have.
 *
 * @param  array<string, mixed>  $data
 */
function storeWhiteboardElement(Whiteboard $board, array $data, int $seq, ?WhiteboardMember $author = null, bool $private = false): WhiteboardElement
{
    return WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id,
        'element_id' => $data['id'],
        'type' => $data['type'],
        'data' => $data,
        'version' => $data['version'],
        'version_nonce' => $data['versionNonce'],
        'author_member_id' => $author?->id,
        'is_sticky' => isset($data['customData']),
        'is_private' => $private,
        'is_deleted' => $data['isDeleted'],
        'seq' => $seq,
    ]);
}

/**
 * @param  array<int, mixed>  $elements
 */
function putWhiteboardElements(mixed $test, Whiteboard $board, array $elements): TestResponse
{
    return $test->putJson(route('whiteboards.elements.update', $board), ['elements' => $elements]);
}

/**
 * The test case acting as a user, or as a guest through their cookie.
 */
function whiteboardViewer(mixed $test, User|WhiteboardMember $viewer): mixed
{
    if ($viewer instanceof User) {
        return $test->actingAs($viewer);
    }

    app('auth')->forgetGuards();

    return $test->withCookies(whiteboardGuestCookie($viewer))->withCredentials();
}

/**
 * Whether a payload (array, JSON or HTML) contains a text that must not leave the server.
 */
function whiteboardPayloadExposes(mixed $payload, string $secret): bool
{
    $text = is_string($payload)
        ? $payload
        : (string) json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    return str_contains($text, $secret);
}

/**
 * A board in private writing: a facilitator, an author who wrote one private
 * note ("note" and its text "note-text", seq 1 and 2), another member, a guest.
 *
 * @return array{board: Whiteboard, facilitator: User, author: User, authorMember: WhiteboardMember, other: User, otherMember: WhiteboardMember, guest: WhiteboardMember, secret: string}
 */
function privateWritingBoard(): array
{
    $board = Whiteboard::factory()->withGuestAccess()->privateWriting()->create(['seq' => 2]);
    [$facilitator] = whiteboardFacilitator($board);
    [$author, $authorMember] = whiteboardMember($board);
    [$other, $otherMember] = whiteboardMember($board);
    $guest = whiteboardGuest($board);
    $secret = 'Secret idea 7391';
    [$note, $text] = stickyWithText('note', $secret);

    storeWhiteboardElement($board, $note, 1, $authorMember, private: true);
    storeWhiteboardElement($board, $text, 2, $authorMember, private: true);

    return [
        'board' => $board,
        'facilitator' => $facilitator,
        'author' => $author,
        'authorMember' => $authorMember,
        'other' => $other,
        'otherMember' => $otherMember,
        'guest' => $guest,
        'secret' => $secret,
    ];
}
```

The secret is plain ASCII on purpose: it reads the same in JSON, in the HTML-escaped `data-page` attribute of the Inertia page and in a log line, so one `str_contains` covers every surface. The board of `privateWritingBoard()` keeps `last_versioned_seq` at 0 with `seq` at 2, so no test that uses it schedules a version (Task 4).

- [ ] **Step 2: Write the failing test**

`tests/Feature/Whiteboards/WhiteboardSecrecyModelTest.php`:

```php
<?php

use App\Actions\Whiteboards\CreateWhiteboard;
use App\Models\Team;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardVersion;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

it('adds private writing and version bookkeeping with safe defaults', function () {
    $board = Whiteboard::factory()->create()->fresh();
    $element = WhiteboardElement::factory()->create(['whiteboard_id' => $board->id])->fresh();

    expect($board->private_writing)->toBeFalse()
        ->and($board->last_versioned_seq)->toBe(0)
        ->and($element->is_private)->toBeFalse()
        ->and(Whiteboard::factory()->privateWriting()->create()->fresh()->private_writing)->toBeTrue();
});

it('stores a version with a creation date only, and removes it with its board', function () {
    $this->travelTo('2026-10-12 10:00:00');

    $board = Whiteboard::factory()->create();
    [, $member] = whiteboardMember($board);
    $automatic = WhiteboardVersion::factory()->create(['whiteboard_id' => $board->id, 'seq' => 4]);
    $named = WhiteboardVersion::factory()->named('Kick-off')->create([
        'whiteboard_id' => $board->id,
        'created_by_member_id' => $member->id,
        'scene' => ['elements' => [sceneElement(['id' => 'box'])], 'fileIds' => []],
    ]);

    expect(Str::isUuid($automatic->id))->toBeTrue()
        ->and(Schema::hasColumn('whiteboard_versions', 'updated_at'))->toBeFalse()
        ->and($automatic->fresh()->created_at->toDateTimeString())->toBe('2026-10-12 10:00:00')
        ->and($automatic->fresh()->isAutomatic())->toBeTrue()
        ->and($automatic->fresh()->seq)->toBe(4)
        ->and($named->fresh()->isAutomatic())->toBeFalse()
        ->and($named->fresh()->scene['elements'][0]['id'])->toBe('box')
        ->and($named->createdBy->is($member))->toBeTrue()
        ->and($board->versions()->count())->toBe(2);

    $member->delete();

    expect($named->fresh()->created_by_member_id)->toBeNull();

    $board->delete();

    expect(WhiteboardVersion::query()->count())->toBe(0);
});

it('says in the snapshot whether private writing is on', function (bool $on) {
    $board = Whiteboard::factory()->create(['private_writing' => $on]);
    [$user] = whiteboardMember($board);

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertOk()
        ->assertJsonPath('board.privateWriting', $on);
})->with([true, false]);

it('starts a board made from a scene with nothing left to version', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $board = app(CreateWhiteboard::class)->handle($team, $user, 'From a scene', [
        'elements' => [sceneElement(['id' => 'first']), sceneElement(['id' => 'second', 'index' => 'a1'])],
        'files' => [],
    ]);

    expect($board->fresh()->seq)->toBe(2)
        ->and($board->fresh()->last_versioned_seq)->toBe(2)
        ->and($board->elements()->where('is_private', true)->count())->toBe(0);
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards/WhiteboardSecrecyModelTest.php`
Expected: FAIL — `Class "App\Models\WhiteboardVersion" not found` (and `Call to undefined method …::privateWriting()`).

- [ ] **Step 4: Migration**

Run `php artisan make:migration add_private_writing_and_versions_to_whiteboards --no-interaction`, then rename the created file to `database/migrations/2026_10_12_100000_add_private_writing_and_versions_to_whiteboards.php` (the date keeps it after plan 17c's migrations) and give it this content:

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
        Schema::table('whiteboards', function (Blueprint $table) {
            $table->boolean('private_writing')->default(false);
            $table->unsignedBigInteger('last_versioned_seq')->default(0);
        });

        DB::table('whiteboards')->update(['last_versioned_seq' => DB::raw('seq')]);

        Schema::table('whiteboard_elements', function (Blueprint $table) {
            $table->boolean('is_private')->default(false);
        });

        Schema::create('whiteboard_versions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('whiteboard_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80)->nullable();
            $table->json('scene');
            $table->unsignedBigInteger('seq');
            $table->foreignUuid('created_by_member_id')->nullable()->constrained('whiteboard_members')->nullOnDelete();
            $table->timestamp('created_at')->nullable();

            $table->index(['whiteboard_id', 'created_at']);
        });
    }
};
```

The `update` gives every existing board `last_versioned_seq = seq`: "nothing to version yet", so that its next write is "the first write after the last version" and schedules one (Task 4). Without it an existing board with content would never get an automatic version.

- [ ] **Step 5: Models and factories**

`app/Models/WhiteboardVersion.php` (`public const UPDATED_AT = null` is how `app/Models/GameGuess.php` keeps `created_at` only):

```php
<?php

namespace App\Models;

use Database\Factories\WhiteboardVersionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * The live scene of a board at one moment, as stored: real text, no viewer.
 * A null name means the version was stored automatically.
 *
 * @phpstan-type VersionScene array{elements: list<array<string, mixed>>, fileIds: list<string>}
 *
 * @property string $id
 * @property string $whiteboard_id
 * @property string|null $name
 * @property VersionScene $scene
 * @property int $seq
 * @property string|null $created_by_member_id
 * @property Carbon $created_at
 * @property-read Whiteboard $whiteboard
 * @property-read WhiteboardMember|null $createdBy
 */
#[Fillable(['whiteboard_id', 'name', 'scene', 'seq', 'created_by_member_id'])]
class WhiteboardVersion extends Model
{
    /** @use HasFactory<WhiteboardVersionFactory> */
    use HasFactory;

    use HasUuids;

    public const UPDATED_AT = null;

    public const MaxNamed = 100;

    public const KeptAutomatic = 50;

    /** @return BelongsTo<Whiteboard, $this> */
    public function whiteboard(): BelongsTo
    {
        return $this->belongsTo(Whiteboard::class);
    }

    /** @return BelongsTo<WhiteboardMember, $this> */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(WhiteboardMember::class, 'created_by_member_id');
    }

    public function isAutomatic(): bool
    {
        return $this->name === null;
    }

    protected function casts(): array
    {
        return [
            'scene' => 'array',
            'seq' => 'integer',
        ];
    }
}
```

`database/factories/WhiteboardVersionFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\Whiteboard;
use App\Models\WhiteboardVersion;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WhiteboardVersion>
 */
class WhiteboardVersionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'whiteboard_id' => Whiteboard::factory(),
            'name' => null,
            'scene' => ['elements' => [], 'fileIds' => []],
            'seq' => 0,
            'created_by_member_id' => null,
        ];
    }

    public function named(string $name = 'Checkpoint'): static
    {
        return $this->state(fn () => ['name' => $name]);
    }
}
```

In `app/Models/Whiteboard.php`: add `@property bool $private_writing` and `@property int $last_versioned_seq` to the docblock; add `'private_writing'` and `'last_versioned_seq'` to the `#[Fillable([...])]` list; add `'private_writing' => 'boolean'` and `'last_versioned_seq' => 'integer'` to `casts()`; add the relation:

```php
    /** @return HasMany<WhiteboardVersion, $this> */
    public function versions(): HasMany
    {
        return $this->hasMany(WhiteboardVersion::class);
    }
```

In `app/Models/WhiteboardElement.php`: add `@property bool $is_private`, add `'is_private'` to the `#[Fillable([...])]` list (after `'is_sticky'`) and `'is_private' => 'boolean'` to `casts()`.

In `database/factories/WhiteboardFactory.php`, after `withGuestAccess()`:

```php
    public function privateWriting(): static
    {
        return $this->state(fn () => ['private_writing' => true]);
    }
```

- [ ] **Step 6: Snapshot flag and the copy path**

In `app/Actions/Whiteboards/BuildWhiteboardSnapshot.php` add `privateWriting: bool` to the `board` shape of the `@phpstan-type Snapshot` (after `reactionsEnabled: bool`, with a comma on the line above) and, in the `board` array, after `'reactionsEnabled' => $board->reactions_enabled,`:

```php
                'privateWriting' => $board->private_writing,
```

In `app/Actions/Whiteboards/CopyWhiteboardScene.php` replace the last statement of `handle()`

```php
        $board->update(['seq' => count($rows)]);
```

with

```php
        $board->update(['seq' => count($rows), 'last_versioned_seq' => count($rows)]);
```

A board made from a template, a duplicate or a version holds only what its source held; the first edit is what there is to version.

- [ ] **Step 7: Run, gates, commit**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards tests/Feature/UuidPrimaryKeysTest.php`
Expected: PASS (the existing snapshot tests use `assertJsonPath`, so the added key breaks none).

```bash
vendor/bin/sail artisan migrate --no-interaction
vendor/bin/pint --dirty --format agent
vendor/bin/phpstan analyse --memory-limit=1G app/Models/WhiteboardVersion.php app/Models/Whiteboard.php app/Models/WhiteboardElement.php app/Actions/Whiteboards/BuildWhiteboardSnapshot.php app/Actions/Whiteboards/CopyWhiteboardScene.php database/factories/WhiteboardVersionFactory.php database/factories/WhiteboardFactory.php
git add database/migrations/2026_10_12_100000_add_private_writing_and_versions_to_whiteboards.php app/Models/WhiteboardVersion.php app/Models/Whiteboard.php app/Models/WhiteboardElement.php database/factories/WhiteboardVersionFactory.php database/factories/WhiteboardFactory.php app/Actions/Whiteboards/BuildWhiteboardSnapshot.php app/Actions/Whiteboards/CopyWhiteboardScene.php tests/Pest.php tests/Feature/Whiteboards/WhiteboardSecrecyModelTest.php
git commit -m "feat(whiteboard): columns and table for private writing and version history"
```

**UI strings added by this task:** none.

---
### Task 2: Private notes — masking and write rules

The heart of R9. After this task a board whose `private_writing` column is true (set through the factory; the switch itself is Task 3) stores new sticky notes as private, serves them masked to everyone but their author on every element surface, refuses what others do to them, and broadcasts their writes without elements.

**Files:**
- Create: `app/Actions/Whiteboards/KeepWhiteboardTextOutOfLogs.php`, `app/Exceptions/WhiteboardQueryFailed.php`
- Modify: `app/Actions/Whiteboards/PresentWhiteboardElement.php`, `app/Actions/Whiteboards/WriteWhiteboardElements.php`
- Test: `tests/Feature/Whiteboards/WhiteboardPrivateWritingTest.php`

**Interfaces:**
- Consumes (Task 1): `Whiteboard::$private_writing`, `WhiteboardElement::$is_private`, the helpers `privateWritingBoard()`, `stickyWithText()`, `storeWhiteboardElement()`, `putWhiteboardElements()`, `whiteboardViewer()`, `whiteboardPayloadExposes()`.
- Consumes (existing): `PresentWhiteboardElement::handle(WhiteboardElement $element, WhiteboardMember $viewer): array`; `WriteWhiteboardElements::handle(Whiteboard $board, WhiteboardMember $member, array $rawElements): array{seq: int, fromSeq: int, rejected: list<array{id: ?string, reason: string, element: ?array}>}`; `WhiteboardElementsChanged(string $boardId, int $seq, int $fromSeq, ?array $elements)`.
- Produces:
  - Masked wire shape (see "Wire shape of a private note" above) from `PresentWhiteboardElement::handle`, unchanged signature.
  - Rejection reason `'private'`.
  - `KeepWhiteboardTextOutOfLogs::handle(string $boardId, Closure $work): mixed` — runs `$work`, turning a `QueryException` into `WhiteboardQueryFailed`.
  - `App\Exceptions\WhiteboardQueryFailed(string $boardId, string $sqlState)`.

**Rules implemented here** (spec §11.5; the board row is locked, `$existing` is the stored row of the incoming element, `$container` the stored row its `containerId` names — rows saved earlier in the same batch count as stored):

1. *Refusal `private`*, checked right after `stale` and before `locked`, for the facilitator too:
   - `$existing` is private and its author is not the writer (edit, move, delete, re-bind, detach, restore of a tombstone);
   - `$container` is private and its author is not the writer (binding a text to someone else's private note);
   - `$container` is private and `$existing` exists with another author (a private note only takes text written by its own author).
2. *Privacy of the saved row*: false whenever the board's `private_writing` is off. Otherwise true when `$existing` is private, or `$container` is private, or the element is new and is either a sticky note (it carries the sticky marker) or a text with a `containerId` whose container is not stored. A write never clears the flag while private writing is on.
3. *Broadcast*: when any accepted row is private, `elements` is null (ids-only form), whatever the size.
4. A masked copy sent back unchanged has the stored `version` and `versionNonce`: the existing "same write" rule ignores it. A masked copy with a higher nonce is `stale`. Neither reaches rule 1, and neither changes anything.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Whiteboards/WhiteboardPrivateWritingTest.php`:

```php
<?php

use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake([WhiteboardElementsChanged::class]);
});

/**
 * What every `elements.changed` of the test put on the wire.
 *
 * @return list<array<string, mixed>>
 */
function elementsChangedPayloads(): array
{
    return Event::dispatched(WhiteboardElementsChanged::class)
        ->map(fn (array $arguments): array => $arguments[0]->broadcastWith())
        ->values()
        ->all();
}

/**
 * @return array<string, bool>
 */
function privateFlags(Whiteboard $board): array
{
    return $board->elements()->orderBy('seq')->get()
        ->mapWithKeys(fn (WhiteboardElement $element): array => [$element->element_id => $element->is_private])
        ->all();
}

it('stores a sticky note and its text as private while private writing is on, and nothing else', function () {
    $board = Whiteboard::factory()->privateWriting()->create();
    [$user, $member] = whiteboardMember($board);
    [$note, $text] = stickyWithText('note', 'Secret idea 7391');

    putWhiteboardElements($this->actingAs($user), $board, [
        $note,
        $text,
        sceneElement(['id' => 'box', 'index' => 'a3', 'boundElements' => [['id' => 'label', 'type' => 'text']]]),
        sceneElement(['id' => 'label', 'type' => 'text', 'index' => 'a4', 'text' => 'Visible label', 'containerId' => 'box']),
        sceneElement(['id' => 'free', 'type' => 'text', 'index' => 'a5', 'text' => 'Visible text', 'containerId' => null]),
    ])->assertOk()->assertJsonPath('rejected', []);

    expect(privateFlags($board))->toBe(['note' => true, 'note-text' => true, 'box' => false, 'label' => false, 'free' => false])
        ->and($board->elements()->where('element_id', 'note-text')->sole()->author_member_id)->toBe($member->id)
        ->and($board->elements()->where('element_id', 'note-text')->sole()->data['text'])->toBe('Secret idea 7391');
});

it('hides nothing while private writing is off', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    putWhiteboardElements($this->actingAs($user), $board, stickyWithText('note', 'Plain idea'))->assertOk();

    expect(privateFlags($board))->toBe(['note' => false, 'note-text' => false])
        ->and(elementsChangedPayloads()[0]['elements'][1]['text'])->toBe('Plain idea');
});

it('leaves the notes written before private writing visible, with what is typed into them', function () {
    $board = Whiteboard::factory()->privateWriting()->create(['seq' => 1]);
    [$author, $authorMember] = whiteboardMember($board);
    [$other] = whiteboardMember($board);
    [$note, $text] = stickyWithText('old', 'Written before');
    storeWhiteboardElement($board, $note, 1, $authorMember);

    putWhiteboardElements($this->actingAs($author), $board, [$text, [...$note, 'version' => 2, 'x' => 40]])
        ->assertOk()
        ->assertJsonPath('rejected', []);

    expect(privateFlags($board))->toBe(['old-text' => false, 'old' => false])
        ->and(elementsChangedPayloads()[0]['elements'])->toHaveCount(2);

    $this->actingAs($other)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertOk()
        ->assertJsonPath('elements.0.customData', ['skrum' => ['kind' => 'sticky']])
        ->assertJsonPath('elements.1.text', 'Written before');
});

it('gives the author the real note, in every tab', function () {
    $table = privateWritingBoard();

    $this->actingAs($table['author'])
        ->getJson(route('whiteboards.snapshot.show', $table['board']))
        ->assertOk()
        ->assertJsonPath('elements.0.customData', ['skrum' => ['kind' => 'sticky']])
        ->assertJsonPath('elements.1.text', $table['secret'])
        ->assertJsonPath('elements.1.originalText', $table['secret']);

    $this->actingAs($table['author'])
        ->getJson(route('whiteboards.elements.index', [$table['board'], 'since' => 0]))
        ->assertOk()
        ->assertJsonPath('elements.1.text', $table['secret']);
});

it('masks a private note for everyone but its author', function (string $viewer) {
    $table = privateWritingBoard();
    $request = fn () => whiteboardViewer($this, $table[$viewer]);

    $snapshot = $request()->getJson(route('whiteboards.snapshot.show', $table['board']))
        ->assertOk()
        ->assertJsonPath('elements.0.id', 'note')
        ->assertJsonPath('elements.0.customData', ['skrum' => ['kind' => 'sticky', 'masked' => true]])
        ->assertJsonPath('elements.0.x', 10)
        ->assertJsonPath('elements.0.y', 20)
        ->assertJsonPath('elements.0.width', 100)
        ->assertJsonPath('elements.0.height', 50)
        ->assertJsonPath('elements.0.backgroundColor', '#fff3bf')
        ->assertJsonPath('elements.0.boundElements', [['id' => 'note-text', 'type' => 'text']])
        ->assertJsonPath('elements.1.id', 'note-text')
        ->assertJsonPath('elements.1.text', '')
        ->assertJsonPath('elements.1.originalText', '')
        ->assertJsonPath('elements.1.containerId', 'note')
        ->assertJsonPath('elements.1.isDeleted', false)
        ->assertJsonPath('elements.1.version', 1)
        ->assertJsonPath('elements.1.versionNonce', 100);

    $delta = $request()->getJson(route('whiteboards.elements.index', [$table['board'], 'since' => 0]))
        ->assertOk()
        ->assertJsonPath('elements.0.customData.skrum.masked', true)
        ->assertJsonPath('elements.1.text', '');

    $page = $request()->get(route('whiteboards.show', $table['board']))->assertOk();

    expect(whiteboardPayloadExposes($snapshot->getContent(), $table['secret']))->toBeFalse()
        ->and(whiteboardPayloadExposes($delta->getContent(), $table['secret']))->toBeFalse()
        ->and(whiteboardPayloadExposes($page->getContent(), $table['secret']))->toBeFalse();
})->with([
    'another member' => 'other',
    'the facilitator' => 'facilitator',
    'a guest' => 'guest',
]);

it('masks a private note whose author is gone for everyone', function () {
    $board = Whiteboard::factory()->privateWriting()->create(['seq' => 2]);
    [$user] = whiteboardFacilitator($board);
    [$note, $text] = stickyWithText('orphan', 'Secret idea 7391');
    storeWhiteboardElement($board, $note, 1, null, private: true);
    storeWhiteboardElement($board, $text, 2, null, private: true);

    $snapshot = $this->actingAs($user)->getJson(route('whiteboards.snapshot.show', $board))->assertOk();

    expect(whiteboardPayloadExposes($snapshot->getContent(), 'Secret idea'))->toBeFalse();

    putWhiteboardElements($this->actingAs($user), $board, [[...$text, 'version' => 2, 'text' => 'Mine now']])
        ->assertJsonPath('rejected.0.reason', 'private');
});

it('never broadcasts the elements of a write that touches a private note', function () {
    $board = Whiteboard::factory()->privateWriting()->create();
    [$author] = whiteboardMember($board);
    [$note, $text] = stickyWithText('note', 'Secret idea 7391');
    $longer = 'Secret idea 7391, longer';

    putWhiteboardElements($this->actingAs($author), $board, [$note, $text, sceneElement(['id' => 'box', 'index' => 'a3'])])->assertOk();
    putWhiteboardElements($this->actingAs($author), $board, [[...$text, 'version' => 2, 'text' => $longer, 'originalText' => $longer]])->assertOk();
    putWhiteboardElements($this->actingAs($author), $board, [[...$note, 'version' => 2, 'x' => 300]])->assertOk();
    putWhiteboardElements($this->actingAs($author), $board, [sceneElement(['id' => 'box', 'index' => 'a3', 'version' => 2, 'x' => 77])])->assertOk();

    $payloads = elementsChangedPayloads();

    expect(array_slice($payloads, 0, 3))->toBe([
        ['seq' => 3, 'fromSeq' => 0],
        ['seq' => 4, 'fromSeq' => 3],
        ['seq' => 5, 'fromSeq' => 4],
    ])
        ->and($payloads[3]['elements'][0]['id'])->toBe('box')
        ->and(whiteboardPayloadExposes($payloads, 'Secret idea'))->toBeFalse();
});

it('refuses every change another member makes to a private note and keeps the text', function (string $viewer) {
    $table = privateWritingBoard();
    $board = $table['board'];
    $request = fn () => whiteboardViewer($this, $table[$viewer]);
    [$note, $masked] = stickyWithText('note', '');

    putWhiteboardElements($request(), $board, [$masked, $note])
        ->assertOk()
        ->assertExactJson(['seq' => 2, 'fromSeq' => 2, 'rejected' => []]);

    $edit = putWhiteboardElements($request(), $board, [
        [...$masked, 'version' => 2, 'text' => 'Overwritten', 'originalText' => 'Overwritten'],
        [...$note, 'version' => 2, 'x' => 900],
    ])
        ->assertOk()
        ->assertJsonPath('seq', 2)
        ->assertJsonPath('rejected.0.id', 'note-text')
        ->assertJsonPath('rejected.0.reason', 'private')
        ->assertJsonPath('rejected.0.element.text', '')
        ->assertJsonPath('rejected.0.element.version', 1)
        ->assertJsonPath('rejected.1.id', 'note')
        ->assertJsonPath('rejected.1.reason', 'private')
        ->assertJsonPath('rejected.1.element.x', 10)
        ->assertJsonPath('rejected.1.element.customData.skrum.masked', true);

    $deletion = putWhiteboardElements($request(), $board, [
        [...$masked, 'version' => 2, 'isDeleted' => true],
        [...$note, 'version' => 2, 'isDeleted' => true],
    ])
        ->assertOk()
        ->assertJsonPath('rejected.0.reason', 'private')
        ->assertJsonPath('rejected.1.reason', 'private');

    $stale = putWhiteboardElements($request(), $board, [[...$masked, 'versionNonce' => 500, 'text' => 'Overwritten']])
        ->assertOk()
        ->assertJsonPath('rejected.0.reason', 'stale')
        ->assertJsonPath('rejected.0.element.text', '');

    $storedText = $board->elements()->where('element_id', 'note-text')->sole();
    $storedNote = $board->elements()->where('element_id', 'note')->sole();

    expect($storedText->data['text'])->toBe($table['secret'])
        ->and($storedText->data['containerId'])->toBe('note')
        ->and($storedText->is_deleted)->toBeFalse()
        ->and($storedText->version)->toBe(1)
        ->and($storedNote->data['x'])->toBe(10)
        ->and($storedNote->is_deleted)->toBeFalse()
        ->and($board->fresh()->seq)->toBe(2)
        ->and(whiteboardPayloadExposes($edit->getContent().$deletion->getContent().$stale->getContent(), $table['secret']))->toBeFalse();

    Event::assertNotDispatched(WhiteboardElementsChanged::class);
})->with([
    'another member' => 'other',
    'the facilitator' => 'facilitator',
    'a guest' => 'guest',
]);

it('refuses to bind a text to a private note of someone else, or to detach its text', function () {
    $table = privateWritingBoard();
    $board = $table['board'];
    storeWhiteboardElement($board, sceneElement(['id' => 'mine', 'type' => 'text', 'text' => 'Mine', 'containerId' => null, 'index' => 'a5']), 3, $table['otherMember']);
    $board->update(['seq' => 3]);

    putWhiteboardElements($this->actingAs($table['other']), $board, [
        sceneElement(['id' => 'intruder', 'type' => 'text', 'text' => 'Typed over', 'containerId' => 'note', 'index' => 'a6']),
        sceneElement(['id' => 'mine', 'type' => 'text', 'text' => 'Mine', 'containerId' => 'note', 'index' => 'a5', 'version' => 2]),
        sceneElement(['id' => 'note-text', 'type' => 'text', 'text' => '', 'originalText' => '', 'containerId' => null, 'index' => 'a2', 'version' => 2]),
    ])
        ->assertOk()
        ->assertJsonPath('seq', 3)
        ->assertJsonPath('rejected.0', ['id' => 'intruder', 'reason' => 'private', 'element' => null])
        ->assertJsonPath('rejected.1.id', 'mine')
        ->assertJsonPath('rejected.1.reason', 'private')
        ->assertJsonPath('rejected.1.element.containerId', null)
        ->assertJsonPath('rejected.2.id', 'note-text')
        ->assertJsonPath('rejected.2.reason', 'private')
        ->assertJsonPath('rejected.2.element.containerId', 'note');

    $stored = $board->elements()->where('element_id', 'note-text')->sole();

    expect($board->elements()->where('element_id', 'intruder')->exists())->toBeFalse()
        ->and($stored->data['containerId'])->toBe('note')
        ->and($stored->data['text'])->toBe($table['secret']);
});

it('lets a private note take only the texts of its own author', function () {
    $table = privateWritingBoard();
    $board = $table['board'];
    storeWhiteboardElement($board, sceneElement(['id' => 'theirs', 'type' => 'text', 'text' => 'Theirs', 'containerId' => null, 'index' => 'a5']), 3, $table['otherMember']);
    storeWhiteboardElement($board, sceneElement(['id' => 'own', 'type' => 'text', 'text' => 'Own', 'containerId' => null, 'index' => 'a6']), 4, $table['authorMember']);
    $board->update(['seq' => 4]);

    putWhiteboardElements($this->actingAs($table['author']), $board, [
        sceneElement(['id' => 'theirs', 'type' => 'text', 'text' => 'Theirs', 'containerId' => 'note', 'index' => 'a5', 'version' => 2]),
        sceneElement(['id' => 'own', 'type' => 'text', 'text' => 'Own, now hidden', 'containerId' => 'note', 'index' => 'a6', 'version' => 2]),
        sceneElement(['id' => 'second', 'type' => 'text', 'text' => 'Typed later', 'containerId' => 'note', 'index' => 'a7']),
    ])
        ->assertOk()
        ->assertJsonCount(1, 'rejected')
        ->assertJsonPath('rejected.0.id', 'theirs')
        ->assertJsonPath('rejected.0.reason', 'private')
        ->assertJsonPath('rejected.0.element.text', 'Theirs');

    expect(privateFlags($board))->toBe(['note' => true, 'note-text' => true, 'theirs' => false, 'own' => true, 'second' => true])
        ->and(elementsChangedPayloads())->toBe([['seq' => 6, 'fromSeq' => 4]]);
});

it('lets the author change, delete and bring back their note, which stays private', function () {
    $table = privateWritingBoard();
    $board = $table['board'];
    [, $text] = stickyWithText('note', $table['secret']);
    $longer = "{$table['secret']} and more";
    $author = fn () => $this->actingAs($table['author']);

    putWhiteboardElements($author(), $board, [[...$text, 'version' => 2, 'text' => $longer, 'originalText' => $longer]])->assertJsonPath('rejected', []);
    putWhiteboardElements($author(), $board, [[...$text, 'version' => 3, 'isDeleted' => true]])->assertJsonPath('rejected', []);

    $tombstone = $this->actingAs($table['other'])
        ->getJson(route('whiteboards.elements.index', [$board, 'since' => 2]))
        ->assertOk()
        ->assertJsonPath('elements.0.id', 'note-text')
        ->assertJsonPath('elements.0.isDeleted', true)
        ->assertJsonPath('elements.0.text', '');

    putWhiteboardElements($author(), $board, [[...$text, 'version' => 4]])->assertJsonPath('rejected', []);

    $stored = $board->elements()->where('element_id', 'note-text')->sole();

    expect($stored->is_private)->toBeTrue()
        ->and($stored->is_deleted)->toBeFalse()
        ->and($stored->version)->toBe(4)
        ->and($stored->data['text'])->toBe($table['secret'])
        ->and(whiteboardPayloadExposes($tombstone->getContent(), $table['secret']))->toBeFalse()
        ->and(elementsChangedPayloads())->toBe([
            ['seq' => 3, 'fromSeq' => 2],
            ['seq' => 4, 'fromSeq' => 3],
            ['seq' => 5, 'fromSeq' => 4],
        ]);
});

it('treats a bound text whose container is unknown as private while private writing is on', function () {
    $board = Whiteboard::factory()->privateWriting()->create();
    [$author] = whiteboardMember($board);
    [$other] = whiteboardMember($board);

    putWhiteboardElements($this->actingAs($author), $board, [
        sceneElement(['id' => 'early', 'type' => 'text', 'text' => 'Secret idea 7391', 'originalText' => 'Secret idea 7391', 'containerId' => 'not-written-yet']),
    ])->assertOk()->assertJsonPath('rejected', []);

    $snapshot = $this->actingAs($other)->getJson(route('whiteboards.snapshot.show', $board))->assertOk();

    expect(privateFlags($board))->toBe(['early' => true])
        ->and(elementsChangedPayloads())->toBe([['seq' => 1, 'fromSeq' => 0]])
        ->and(whiteboardPayloadExposes($snapshot->getContent(), 'Secret idea'))->toBeFalse();
});

it('keeps the text of a note out of the log, even when the database refuses the write', function () {
    $table = privateWritingBoard();
    [, $text] = stickyWithText('note', $table['secret']);
    $again = "{$table['secret']} again";
    $lines = [];

    Event::listen(MessageLogged::class, function (MessageLogged $logged) use (&$lines): void {
        $lines[] = $logged->message;
        $exception = $logged->context['exception'] ?? null;

        while ($exception instanceof Throwable) {
            $lines[] = $exception->getMessage();
            $exception = $exception->getPrevious();
        }
    });

    DB::statement('alter table whiteboard_elements add constraint whiteboard_elements_refused check (version < 2)');

    $failed = putWhiteboardElements($this->actingAs($table['author']), $table['board'], [
        [...$text, 'version' => 2, 'text' => $again, 'originalText' => $again],
    ])->assertStatus(500);

    putWhiteboardElements($this->actingAs($table['other']), $table['board'], [[...$text, 'version' => 2, 'text' => 'Overwritten']])
        ->assertOk()
        ->assertJsonPath('rejected.0.reason', 'private');

    expect($lines)->not->toBeEmpty()
        ->and(whiteboardPayloadExposes($lines, $table['secret']))->toBeFalse()
        ->and(whiteboardPayloadExposes($failed->getContent(), $table['secret']))->toBeFalse()
        ->and($table['board']->elements()->where('element_id', 'note-text')->sole()->data['text'])->toBe($table['secret']);
});
```

Notes on the last test: the check constraint lives in the test's transaction and is rolled back with it. The failing `update` runs inside `DB::transaction` at a nested level, so Laravel rolls back to its savepoint and the test's own transaction stays usable. PostgreSQL's message for a check violation contains the failing row ("Failing row contains (…)"), which is exactly what must not reach the log.

- [ ] **Step 2: Run it to see it fail**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards/WhiteboardPrivateWritingTest.php`
Expected: FAIL — the first test reports `note => false`; the masking tests find the secret in the snapshot; the log test finds it in the `QueryException` message.

- [ ] **Step 3: The exception and the wrapper**

`app/Exceptions/WhiteboardQueryFailed.php`:

```php
<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Stands in for a QueryException on statements that carry note text: its
 * message holds neither the statement nor its bindings, and it has no
 * previous exception, so nothing of the scene reaches a log or a failed job.
 */
class WhiteboardQueryFailed extends RuntimeException
{
    public function __construct(public string $boardId, public string $sqlState)
    {
        parent::__construct("A query on whiteboard {$boardId} failed (SQLSTATE {$sqlState}).");
    }
}
```

`app/Actions/Whiteboards/KeepWhiteboardTextOutOfLogs.php`:

```php
<?php

namespace App\Actions\Whiteboards;

use App\Exceptions\WhiteboardQueryFailed;
use Closure;
use Illuminate\Database\QueryException;

class KeepWhiteboardTextOutOfLogs
{
    /**
     * @template TResult
     *
     * @param  Closure(): TResult  $work
     * @return TResult
     */
    public function handle(string $boardId, Closure $work): mixed
    {
        try {
            return $work();
        } catch (QueryException $exception) {
            throw new WhiteboardQueryFailed($boardId, (string) $exception->getCode());
        }
    }
}
```

Checked: `Illuminate\Database\QueryException::formatMessage()` (`vendor/laravel/framework/src/Illuminate/Database/QueryException.php`) builds its message from the previous exception's message and the SQL with bindings substituted. Laravel 13 has a connection option `mask_bindings_in_exception_messages`, but it is application-wide and leaves PostgreSQL's "Failing row contains" detail in place; this wrapper is local to the statements that carry note text.

- [ ] **Step 4: Mask in the presenter**

Replace the body of `handle()` in `app/Actions/Whiteboards/PresentWhiteboardElement.php` and its class docblock:

```php
/**
 * The only place an element is turned into a payload. A private element
 * (spec §11.5) is real for its author only: everyone else, the facilitator
 * included, gets the note with the `masked` marker and its text emptied.
 * Position, size, colour, version and nonce are the stored ones.
 */
class PresentWhiteboardElement
{
    /**
     * @return array<string, mixed>
     */
    public function handle(WhiteboardElement $element, WhiteboardMember $viewer): array
    {
        if (! $element->is_private || $element->author_member_id === $viewer->id) {
            return $element->data;
        }

        if ($element->type === 'text') {
            return [...$element->data, 'text' => '', 'originalText' => ''];
        }

        return [...$element->data, 'customData' => ['skrum' => ['kind' => 'sticky', 'masked' => true]]];
    }
}
```

`masked` exists only on the wire: `SanitizeWhiteboardElement::withStickyMarkerOnly()` reduces `customData` to `{skrum: {kind: 'sticky'}}` on every write, so a client that sends the marker back cannot store it.

- [ ] **Step 5: The write rules**

Edit `app/Actions/Whiteboards/WriteWhiteboardElements.php` as follows. (Plan 17c edits the same class for the board lock and the voting text freeze: keep its changes, and place the `private` check right after `stale` in `refusal()`.)

a. Constructor: add a fourth dependency.

```php
    public function __construct(
        private SanitizeWhiteboardElement $sanitizeWhiteboardElement,
        private PresentWhiteboardElement $presentWhiteboardElement,
        private OrderWhiteboardElements $orderWhiteboardElements,
        private KeepWhiteboardTextOutOfLogs $keepWhiteboardTextOutOfLogs,
    ) {}
```

b. `handle()`: wrap the existing transaction, body unchanged.

```php
        return $this->keepWhiteboardTextOutOfLogs->handle($board->id, fn (): array => DB::transaction(function () use ($board, $member, $rawElements): array {
            // the existing body
        }));
```

c. Inside the loop, replace from `$existing = $stored->get($element['id']);` to the `$saved = …` line by:

```php
                $existing = $stored->get($element['id']);
                $container = $this->container($element, $stored);

                if ($this->isSameWrite($existing, $element)) {
                    continue;
                }

                $reason = $this->refusal($existing, $container, $element, $member, $isFacilitator, $fileIds, $liveCount);

                if ($reason !== null) {
                    $rejected[] = $this->rejection($element['id'], $reason, $existing, $member);

                    continue;
                }

                $liveCount += $this->liveDelta($existing, $element);
                $seq++;

                $saved = $this->save($locked, $member, $existing, $element, $seq, $this->isPrivate($locked, $existing, $container, $element));
```

d. `storedElements()` also loads the containers the batch names:

```php
        $ids = collect($rawElements)
            ->flatMap(fn (mixed $raw): array => [$this->rawId($raw), $this->rawContainerId($raw)])
            ->filter()
            ->unique()
            ->values();
```

with, next to `rawId()`:

```php
    private function rawContainerId(mixed $raw): ?string
    {
        if (! is_array($raw)) {
            return null;
        }

        $containerId = $raw['containerId'] ?? null;

        if (! is_string($containerId) || preg_match(SanitizeWhiteboardElement::IdPattern, $containerId) !== 1) {
            return null;
        }

        return $containerId;
    }
```

e. `refusal()` gains the container and the writer, and the `private` reason after `stale`:

```php
    /**
     * @param  array<string, mixed>  $element
     * @param  Collection<string, int>  $fileIds
     */
    private function refusal(?WhiteboardElement $existing, ?WhiteboardElement $container, array $element, WhiteboardMember $member, bool $isFacilitator, Collection $fileIds, int $liveCount): ?string
    {
        if ($this->isStale($existing, $element)) {
            return 'stale';
        }

        if ($this->touchesPrivate($existing, $container, $member)) {
            return 'private';
        }

        // the existing `locked`, `file` and `full` checks, unchanged
    }
```

f. New private methods:

```php
    /**
     * The stored element a text is bound to; only a text keeps `containerId`
     * through the sanitizer.
     *
     * @param  array<string, mixed>  $element
     * @param  Collection<string, WhiteboardElement>  $stored
     */
    private function container(array $element, Collection $stored): ?WhiteboardElement
    {
        $containerId = $element['containerId'] ?? null;

        return is_string($containerId) ? $stored->get($containerId) : null;
    }

    /**
     * Only its author changes a private element, binds a text to it or
     * detaches one, and a private note only takes text its author wrote:
     * a masked copy can then never replace the real text (spec §11.5).
     */
    private function touchesPrivate(?WhiteboardElement $existing, ?WhiteboardElement $container, WhiteboardMember $member): bool
    {
        if ($existing?->is_private && $existing->author_member_id !== $member->id) {
            return true;
        }

        if (! $container?->is_private) {
            return false;
        }

        if ($container->author_member_id !== $member->id) {
            return true;
        }

        return $existing !== null && $existing->author_member_id !== $member->id;
    }

    /**
     * A write gives privacy and never takes it away while private writing
     * is on; only the reveal clears it. A new text whose container is not
     * stored yet is private too: it may be the text of a note still on its way.
     *
     * @param  array<string, mixed>  $element
     */
    private function isPrivate(Whiteboard $board, ?WhiteboardElement $existing, ?WhiteboardElement $container, array $element): bool
    {
        if (! $board->private_writing) {
            return false;
        }

        if ($existing?->is_private || $container?->is_private) {
            return true;
        }

        if ($existing !== null) {
            return false;
        }

        if ($element['type'] === 'text') {
            return ($element['containerId'] ?? null) !== null && $container === null;
        }

        return isset($element['customData']);
    }
```

g. `save()` takes the flag: add the parameter `bool $private` at the end of its signature and `'is_private' => $private,` to `$attributes` (after `'is_sticky'`).

h. `broadcastable()` starts with the ids-only rule:

```php
        if (array_any($accepted, fn (WhiteboardElement $element): bool => $element->is_private)) {
            return null;
        }
```

(`array_any` is PHP 8.4, like `array_all` already used in `SanitizeWhiteboardElement`.) Update the docblock of `broadcastable()`: "null when the payload would exceed one message or holds a private element; clients then fetch their own copy".

What rule 2 means when private writing is off: `isPrivate()` answers false, so a private tombstone its author brings back after the reveal becomes an ordinary note; before that write `touchesPrivate()` still protects it from everyone else, because it reads the row's flag, not the board's.

- [ ] **Step 6: Run the tests**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards`
Expected: PASS, the existing write, delta, snapshot and event tests included (none of their rows is private).

- [ ] **Step 7: Gates and commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/phpstan analyse --memory-limit=1G app/Actions/Whiteboards/PresentWhiteboardElement.php app/Actions/Whiteboards/WriteWhiteboardElements.php app/Actions/Whiteboards/KeepWhiteboardTextOutOfLogs.php app/Exceptions/WhiteboardQueryFailed.php
git add app/Actions/Whiteboards/PresentWhiteboardElement.php app/Actions/Whiteboards/WriteWhiteboardElements.php app/Actions/Whiteboards/KeepWhiteboardTextOutOfLogs.php app/Exceptions/WhiteboardQueryFailed.php tests/Feature/Whiteboards/WhiteboardPrivateWritingTest.php
git commit -m "feat(whiteboard): private notes are masked for everyone but their author"
```

**UI strings added by this task:** none (the reason `private` is shown by the client, Task 7).

---

### Task 3: Private writing — the switch, the reveal, the blocked actions

**Files:**
- Create: `app/Actions/Whiteboards/SetWhiteboardPrivateWriting.php`
- Modify: `app/Actions/Whiteboards/WhiteboardGuard.php`, `app/Http/Controllers/Whiteboards/WhiteboardSettingsController.php`, `app/Actions/Whiteboards/DuplicateWhiteboard.php`, `app/Actions/Whiteboards/SaveWhiteboardTemplate.php`, `lang/{en,fr,de,es}.json`
- Test: `tests/Feature/Whiteboards/WhiteboardPrivateWritingSwitchTest.php`

**Interfaces:**
- Consumes: Tasks 1–2; `WhiteboardChanged(string $boardId)`, `WhiteboardElementsChanged(string $boardId, int $seq, int $fromSeq, ?array $elements)`; `WhiteboardGuard::facilitator`, `::notGuest`; `DuplicateWhiteboard::handle(Whiteboard, User): Whiteboard`; `SaveWhiteboardTemplate::handle(Whiteboard, User, string, ?string): WhiteboardTemplate`.
- Produces:
  - `PATCH whiteboards/{board}/settings` accepts `private_writing: bool` (facilitator; 204; `board.changed`, and `elements.changed` in the ids-only form when a note was revealed).
  - `SetWhiteboardPrivateWriting::handle(Whiteboard $locked, bool $on): void` — the caller holds the lock on the board row.
  - `WhiteboardGuard::notPrivateWriting(Whiteboard $board): void` — throws a `ValidationException` (422) whose message is "Reveal the notes first.". Used by Tasks 5 and 6.
  - `POST duplicate` and `POST template` answer 422 "Reveal the notes first." while private writing is on.

**The reveal, precisely** (spec §11.5, inside the lock):
1. Every **live** private row of the board gets `is_private = false` and `seq = board.seq + 1` (one statement, one new seq for all of them). Versions and nonces do not change.
2. Private **tombstones** keep their flag: a note deleted while hidden is never shown. They stay masked in `GET elements` until the nightly purge removes them; `ReadWhiteboardScene` only reads live rows, so no copy holds them.
3. The board gets `private_writing = false` and, when at least one row was revealed, the new `seq`.
4. After the commit: `elements.changed` `{seq, fromSeq}` (no elements) when a row was revealed, then `board.changed`. The text reaches a client only through `GET elements?since=` or the snapshot.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Whiteboards/WhiteboardPrivateWritingSwitchTest.php`:

```php
<?php

use App\Events\Whiteboards\WhiteboardChanged;
use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardTemplate;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Storage::fake();
    Event::fake([WhiteboardElementsChanged::class, WhiteboardChanged::class]);
});

function setPrivateWriting(mixed $test, Whiteboard $board, mixed $on): TestResponse
{
    return $test->patchJson(route('whiteboards.settings.update', $board), ['private_writing' => $on]);
}

it('lets the facilitator hide the notes to come and leaves the ones already there alone', function () {
    $board = Whiteboard::factory()->create(['seq' => 2]);
    [$facilitator, $member] = whiteboardFacilitator($board);
    [$note, $text] = stickyWithText('old', 'Written before');
    storeWhiteboardElement($board, $note, 1, $member);
    storeWhiteboardElement($board, $text, 2, $member);

    setPrivateWriting($this->actingAs($facilitator), $board, true)->assertNoContent();

    expect($board->fresh()->private_writing)->toBeTrue()
        ->and($board->fresh()->seq)->toBe(2)
        ->and($board->elements()->where('is_private', true)->count())->toBe(0);

    Event::assertDispatched(WhiteboardChanged::class);
    Event::assertNotDispatched(WhiteboardElementsChanged::class);

    $this->actingAs($facilitator)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('board.privateWriting', true)
        ->assertJsonPath('elements.1.text', 'Written before');
});

it('reveals every live private note and makes every client fetch it', function () {
    $table = privateWritingBoard();
    $board = $table['board'];

    setPrivateWriting($this->actingAs($table['facilitator']), $board, false)->assertNoContent();

    $board->refresh();

    expect($board->private_writing)->toBeFalse()
        ->and($board->seq)->toBe(3)
        ->and($board->elements()->where('is_private', true)->count())->toBe(0)
        ->and($board->elements()->pluck('seq')->unique()->values()->all())->toBe([3])
        ->and($board->elements()->where('element_id', 'note-text')->sole()->version)->toBe(1);

    Event::assertDispatched(WhiteboardChanged::class);
    Event::assertDispatched(
        WhiteboardElementsChanged::class,
        fn (WhiteboardElementsChanged $event) => $event->broadcastWith() === ['seq' => 3, 'fromSeq' => 2],
    );

    whiteboardViewer($this, $table['guest'])
        ->getJson(route('whiteboards.elements.index', [$board, 'since' => 2]))
        ->assertOk()
        ->assertJsonPath('seq', 3)
        ->assertJsonPath('elements.0.customData', ['skrum' => ['kind' => 'sticky']])
        ->assertJsonPath('elements.1.text', $table['secret'])
        ->assertJsonPath('elements.1.version', 1)
        ->assertJsonPath('elements.1.versionNonce', 100);

    $this->actingAs($table['other'])
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('board.privateWriting', false)
        ->assertJsonPath('elements.1.text', $table['secret']);
});

it('never shows a private note that was deleted before the reveal', function () {
    $table = privateWritingBoard();
    $board = $table['board'];
    [, $text] = stickyWithText('note', $table['secret']);

    putWhiteboardElements($this->actingAs($table['author']), $board, [[...$text, 'version' => 2, 'isDeleted' => true]])
        ->assertJsonPath('rejected', []);

    setPrivateWriting($this->actingAs($table['facilitator']), $board, false)->assertNoContent();

    $tombstone = $board->elements()->where('element_id', 'note-text')->sole();
    $delta = $this->actingAs($table['other'])->getJson(route('whiteboards.elements.index', [$board, 'since' => 0]))->assertOk();
    $snapshot = $this->actingAs($table['other'])->getJson(route('whiteboards.snapshot.show', $board))->assertOk();

    expect($tombstone->is_private)->toBeTrue()
        ->and($tombstone->seq)->toBe(3)
        ->and($board->elements()->where('element_id', 'note')->sole()->seq)->toBe(4)
        ->and(whiteboardPayloadExposes($delta->getContent(), $table['secret']))->toBeFalse()
        ->and(whiteboardPayloadExposes($snapshot->getContent(), $table['secret']))->toBeFalse();

    putWhiteboardElements($this->actingAs($table['other']), $board, [[...$text, 'text' => '', 'originalText' => '', 'version' => 3]])
        ->assertJsonPath('rejected.0.reason', 'private');

    putWhiteboardElements($this->actingAs($table['author']), $board, [[...$text, 'version' => 3]])
        ->assertJsonPath('rejected', []);

    expect($tombstone->fresh()->is_private)->toBeFalse()
        ->and($tombstone->fresh()->is_deleted)->toBeFalse();

    $this->actingAs($table['other'])
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('elements.1.text', $table['secret']);
});

it('changes nothing when the switch already has that value', function () {
    $board = Whiteboard::factory()->create(['seq' => 5]);
    [$facilitator] = whiteboardFacilitator($board);

    setPrivateWriting($this->actingAs($facilitator), $board, false)->assertNoContent();

    expect($board->fresh()->seq)->toBe(5)
        ->and($board->fresh()->private_writing)->toBeFalse();

    Event::assertNotDispatched(WhiteboardElementsChanged::class);
});

it('reveals without an element event when no note was hidden', function () {
    $board = Whiteboard::factory()->privateWriting()->create(['seq' => 5]);
    [$facilitator] = whiteboardFacilitator($board);

    setPrivateWriting($this->actingAs($facilitator), $board, false)->assertNoContent();

    expect($board->fresh()->seq)->toBe(5)
        ->and($board->fresh()->private_writing)->toBeFalse();

    Event::assertDispatched(WhiteboardChanged::class);
    Event::assertNotDispatched(WhiteboardElementsChanged::class);
});

it('only lets the facilitator switch private writing', function () {
    $table = privateWritingBoard();

    setPrivateWriting($this->actingAs($table['author']), $table['board'], false)->assertForbidden();
    setPrivateWriting(whiteboardViewer($this, $table['guest']), $table['board'], false)->assertForbidden();

    expect($table['board']->fresh()->private_writing)->toBeTrue()
        ->and($table['board']->elements()->where('is_private', true)->count())->toBe(2);
});

it('requires a boolean', function () {
    $board = Whiteboard::factory()->create();
    [$facilitator] = whiteboardFacilitator($board);

    setPrivateWriting($this->actingAs($facilitator), $board, 'maybe')->assertJsonValidationErrors('private_writing');
});

it('refuses duplicate and save as template until the notes are revealed', function () {
    $table = privateWritingBoard();
    $board = $table['board'];

    foreach (['other', 'author', 'facilitator'] as $who) {
        $duplicate = $this->actingAs($table[$who])
            ->postJson(route('whiteboards.duplicate.store', $board))
            ->assertStatus(422)
            ->assertJsonPath('message', 'Reveal the notes first.');

        $template = $this->actingAs($table[$who])
            ->postJson(route('whiteboards.template.store', $board), ['name' => "Kick-off {$who}"])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Reveal the notes first.');

        expect(whiteboardPayloadExposes($duplicate->getContent().$template->getContent(), $table['secret']))->toBeFalse();
    }

    expect(Whiteboard::query()->count())->toBe(1)
        ->and(WhiteboardTemplate::query()->count())->toBe(0)
        ->and(WhiteboardElement::query()->count())->toBe(2);
});

it('copies the notes once they are revealed, and never one deleted while hidden', function () {
    $table = privateWritingBoard();
    $board = $table['board'];
    [$dropped, $droppedText] = stickyWithText('dropped', 'Dropped thought 5522');
    storeWhiteboardElement($board, [...$dropped, 'isDeleted' => true], 3, $table['authorMember'], private: true);
    storeWhiteboardElement($board, [...$droppedText, 'isDeleted' => true], 4, $table['authorMember'], private: true);
    $board->update(['seq' => 4]);

    setPrivateWriting($this->actingAs($table['facilitator']), $board, false)->assertNoContent();

    $this->actingAs($table['other'])->postJson(route('whiteboards.duplicate.store', $board))->assertCreated();
    $this->actingAs($table['other'])->postJson(route('whiteboards.template.store', $board), ['name' => 'Kick-off'])->assertCreated();

    $copy = Whiteboard::query()->whereKeyNot($board->id)->sole();
    $copied = $copy->elements()->get()->map(fn (WhiteboardElement $element): array => $element->data)->all();
    $template = WhiteboardTemplate::query()->sole();

    expect(whiteboardPayloadExposes($copied, $table['secret']))->toBeTrue()
        ->and(whiteboardPayloadExposes($copied, 'Dropped thought'))->toBeFalse()
        ->and($copy->elements()->where('is_private', true)->count())->toBe(0)
        ->and(whiteboardPayloadExposes($template->scene, $table['secret']))->toBeTrue()
        ->and(whiteboardPayloadExposes($template->scene, 'Dropped thought'))->toBeFalse();
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards/WhiteboardPrivateWritingSwitchTest.php`
Expected: FAIL — the first test finds `private_writing` still false (the key is not validated, so it is ignored); the duplicate test gets 201.

- [ ] **Step 3: The guard**

Add to `app/Actions/Whiteboards/WhiteboardGuard.php` (import `Illuminate\Validation\ValidationException`; `PokerGuard::openRound` throws a 422 the same way):

```php
    /**
     * Versions and copies hold the real text of every note (spec §9, §11.5).
     */
    public static function notPrivateWriting(Whiteboard $board): void
    {
        if (! $board->private_writing) {
            return;
        }

        throw ValidationException::withMessages(['board' => __('Reveal the notes first.')]);
    }
```

A `ValidationException` with one message renders as `{"message": "Reveal the notes first.", "errors": {"board": [...]}}` with status 422; the client's `retroRequest` shows the first error (`resources/js/lib/retro/api.ts`).

- [ ] **Step 4: The action**

`app/Actions/Whiteboards/SetWhiteboardPrivateWriting.php`:

```php
<?php

namespace App\Actions\Whiteboards;

use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Models\Whiteboard;

class SetWhiteboardPrivateWriting
{
    /**
     * The caller holds the lock on the board row and broadcasts `board.changed`.
     */
    public function handle(Whiteboard $locked, bool $on): void
    {
        if ($on === $locked->private_writing) {
            return;
        }

        if ($on) {
            $locked->update(['private_writing' => true]);

            return;
        }

        $this->reveal($locked);
    }

    /**
     * Live notes become ordinary elements under a new seq, so that every
     * client fetches them; nothing of them is broadcast. A note deleted
     * while it was hidden keeps its flag and is never shown.
     */
    private function reveal(Whiteboard $locked): void
    {
        $fromSeq = $locked->seq;
        $seq = $fromSeq + 1;

        $revealed = $locked->elements()
            ->where('is_private', true)
            ->where('is_deleted', false)
            ->update(['is_private' => false, 'seq' => $seq]);

        if ($revealed === 0) {
            $locked->update(['private_writing' => false]);

            return;
        }

        $locked->update(['private_writing' => false, 'seq' => $seq]);

        (new WhiteboardElementsChanged($locked->id, $seq, $fromSeq, null))->sendToOthers();
    }
}
```

- [ ] **Step 5: The settings key**

In `app/Http/Controllers/Whiteboards/WhiteboardSettingsController.php` (plan 17c adds its own keys to the same method: keep them): inject the action, validate the key, take it out of the mass update and apply it inside the lock, before `board.changed`.

```php
    public function update(Request $request, Whiteboard $board, SetWhiteboardPrivateWriting $setWhiteboardPrivateWriting): Response
    {
        $member = WhiteboardMember::current($request);

        WhiteboardGuard::facilitator($board, $member);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:120'],
            'guest_access_enabled' => ['sometimes', 'boolean'],
            'cursors_enabled' => ['sometimes', 'boolean'],
            'reactions_enabled' => ['sometimes', 'boolean'],
            'private_writing' => ['sometimes', 'boolean'],
        ]);

        $privateWriting = Arr::pull($validated, 'private_writing');

        DB::transaction(function () use ($board, $member, $validated, $privateWriting, $setWhiteboardPrivateWriting): void {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            WhiteboardGuard::facilitator($locked, $member);

            if ($privateWriting !== null) {
                $setWhiteboardPrivateWriting->handle($locked, (bool) $privateWriting);
            }

            $locked->update($validated);

            (new WhiteboardChanged($locked->id))->sendToOthers();
        });

        return response()->noContent();
    }
```

Imports: `App\Actions\Whiteboards\SetWhiteboardPrivateWriting`, `Illuminate\Support\Arr`.

- [ ] **Step 6: Block duplicate and save as template**

In `app/Actions/Whiteboards/DuplicateWhiteboard.php`, right after the `$locked = …lockForUpdate()->firstOrFail();` line:

```php
            WhiteboardGuard::notPrivateWriting($locked);
```

In `app/Actions/Whiteboards/SaveWhiteboardTemplate.php`, right after its `$locked = …lockForUpdate()->firstOrFail();` line (before the workspace lock):

```php
            WhiteboardGuard::notPrivateWriting($locked);
```

The check sits inside the board lock: a facilitator switching private writing on waits for the copy, or the copy sees the switch. Neither path reads `is_private`: once the notes are revealed no live row carries it, and `ReadWhiteboardScene` reads live rows only.

- [ ] **Step 7: Translations**

| Key (English) | French | German | Spanish |
|---|---|---|---|
| Reveal the notes first. | Révélez d'abord les post-it. | Decken Sie zuerst die Haftnotizen auf. | Revela primero las notas adhesivas. |

Add the key to `lang/en.json` (value = key) and the three others; run `grep -n '"Reveal the notes first."' lang/fr.json` first.

- [ ] **Step 8: 17c step — private writing and voting exclude each other**

Spec §11.4 and §11.5: private writing cannot be turned on while a voting session is open, and a voting session cannot be opened while private writing is on. This step needs plan 17c's `whiteboard_vote_sessions` table (spec §7: `id`, `whiteboard_id`, `votes_per_member`, `frame_element_id`, `allow_multiple`, `opened_by_member_id`, `closed_at`, `dismissed_at`, `results`, timestamps) and its `POST vote-sessions` endpoint. Use 17c's model, factory, guard and route names where they exist; the code below uses the query builder and the names of the spec so that it states the rule without depending on them.

Add to `tests/Feature/Whiteboards/WhiteboardPrivateWritingSwitchTest.php` (imports `Illuminate\Support\Facades\DB`, `Illuminate\Support\Str`):

```php
it('refuses to hide the notes while a vote is open', function () {
    $board = Whiteboard::factory()->create();
    [$facilitator] = whiteboardFacilitator($board);

    DB::table('whiteboard_vote_sessions')->insert([
        'id' => (string) Str::uuid(),
        'whiteboard_id' => $board->id,
        'votes_per_member' => 3,
        'allow_multiple' => false,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    setPrivateWriting($this->actingAs($facilitator), $board, true)
        ->assertStatus(422)
        ->assertJsonPath('message', 'Close the vote first.');

    expect($board->fresh()->private_writing)->toBeFalse();

    DB::table('whiteboard_vote_sessions')->where('whiteboard_id', $board->id)->update(['closed_at' => now()]);

    setPrivateWriting($this->actingAs($facilitator), $board, true)->assertNoContent();
});

it('refuses to open a vote while the notes are hidden', function () {
    $table = privateWritingBoard();

    $this->actingAs($table['facilitator'])
        ->postJson(route('whiteboards.voteSessions.store', $table['board']), ['votes_per_member' => 3, 'allow_multiple' => false])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Reveal the notes first.');

    expect(DB::table('whiteboard_vote_sessions')->where('whiteboard_id', $table['board']->id)->exists())->toBeFalse();
});
```

In `SetWhiteboardPrivateWriting::handle()`, before `$locked->update(['private_writing' => true]);`:

```php
            $this->ensureNoOpenVote($locked);
```

```php
    private function ensureNoOpenVote(Whiteboard $locked): void
    {
        $open = DB::table('whiteboard_vote_sessions')
            ->where('whiteboard_id', $locked->id)
            ->whereNull('closed_at')
            ->exists();

        if (! $open) {
            return;
        }

        throw ValidationException::withMessages(['private_writing' => __('Close the vote first.')]);
    }
```

(imports in the action: `Illuminate\Support\Facades\DB`, `Illuminate\Validation\ValidationException`.)

In 17c's action or controller that opens a session, inside its board lock and before the insert: `WhiteboardGuard::notPrivateWriting($locked);` (if 17c already wrote a check against a column that did not exist yet, replace it by this call).

| Key (English) | French | German | Spanish |
|---|---|---|---|
| Close the vote first. | Clôturez d'abord le vote. | Schließen Sie zuerst die Abstimmung. | Cierra primero la votación. |

If 17c already has a key with this meaning, reuse it and change the assertion.

- [ ] **Step 9: Run, gates, commit**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards tests/Feature/TranslationKeysTest.php`
Expected: PASS.

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/phpstan analyse --memory-limit=1G app/Actions/Whiteboards/SetWhiteboardPrivateWriting.php app/Actions/Whiteboards/WhiteboardGuard.php app/Http/Controllers/Whiteboards/WhiteboardSettingsController.php app/Actions/Whiteboards/DuplicateWhiteboard.php app/Actions/Whiteboards/SaveWhiteboardTemplate.php
git add app/Actions/Whiteboards/SetWhiteboardPrivateWriting.php app/Actions/Whiteboards/WhiteboardGuard.php app/Http/Controllers/Whiteboards/WhiteboardSettingsController.php app/Actions/Whiteboards/DuplicateWhiteboard.php app/Actions/Whiteboards/SaveWhiteboardTemplate.php lang/en.json lang/fr.json lang/de.json lang/es.json tests/Feature/Whiteboards/WhiteboardPrivateWritingSwitchTest.php
git commit -m "feat(whiteboard): the private writing switch, the reveal and the actions it blocks"
```

(Add 17c's file to the `git add` when Step 8 changed one.)

---
### Task 4: Automatic versions

**Files:**
- Create: `app/Actions/Whiteboards/StoreWhiteboardVersion.php`, `app/Actions/Whiteboards/ScheduleWhiteboardVersion.php`, `app/Actions/Whiteboards/QueueMissedWhiteboardVersions.php`, `app/Jobs/StoreAutomaticWhiteboardVersion.php`
- Modify: `app/Actions/Whiteboards/WriteWhiteboardElements.php`, `app/Actions/Whiteboards/SetWhiteboardPrivateWriting.php`, `app/Actions/Whiteboards/PruneWhiteboardFiles.php`, `app/Console/Commands/PruneWhiteboardsCommand.php`
- Test: `tests/Feature/Whiteboards/WhiteboardAutomaticVersionsTest.php`

**Interfaces:**
- Consumes: `ReadWhiteboardScene::handle(Whiteboard $board): array{elements: list<array>, files: list<SceneFile>}` (live elements in canvas order, real text); `KeepWhiteboardTextOutOfLogs::handle(string, Closure): mixed` (Task 2); `WhiteboardVersion`, `Whiteboard::versions()`, `Whiteboard::$last_versioned_seq` (Task 1); `WriteWhiteboardElements`, `SetWhiteboardPrivateWriting` (Tasks 2–3); the job idiom of `app/Jobs/RevealPokerRoundOnTimer.php` and its dispatch in `app/Http/Controllers/Poker/PokerTimersController.php` (`::dispatch(...)->delay(...)->afterCommit()`).
- Produces:
  - `StoreWhiteboardVersion::handle(Whiteboard $locked, ?WhiteboardMember $member, ?string $name): WhiteboardVersion` — the caller holds the lock on the board row. Stores the live scene as `{elements, fileIds}`, sets `last_versioned_seq = seq` without moving `updated_at`, and, for an automatic version (`$name === null`), deletes the automatic versions beyond the 50 most recent. It does **not** check the cap of named versions (Task 5 does, Task 6 must not).
  - `ScheduleWhiteboardVersion::handle(Whiteboard $locked, int $fromSeq): void` — call inside the lock after any change of `seq`; dispatches the job, delayed 5 minutes and after commit, when `$fromSeq === $locked->last_versioned_seq`.
  - `App\Jobs\StoreAutomaticWhiteboardVersion(public string $boardId)`, constant `DelayMinutes = 5`.
  - `QueueMissedWhiteboardVersions::handle(): int`, run by `skrum:prune-whiteboards`.
  - `PruneWhiteboardFiles` keeps a file referenced by a version of its board.

**The cadence, precisely** (spec §9):
- The board row carries `last_versioned_seq`: the `seq` of the last version stored (automatic, named, or "Before restore"). `seq > last_versioned_seq` means "there is something to version".
- Every operation that raises `seq` calls `ScheduleWhiteboardVersion` with the `seq` it started from: element writes (here), the reveal (here), restore (Task 6). When that starting `seq` equals `last_versioned_seq` this is the first change after the last version: one job is queued for five minutes later. Later changes queue nothing: a job is already on its way.
- The job locks the board and stores a version when `seq > last_versioned_seq` **and** no automatic version of the board is younger than five minutes. That second condition is what makes "at most one per five minutes" true when a named version was saved in between (it resets `last_versioned_seq`, so the next write queues a second job while the first is still due). When a job skips for that reason, the write that followed the young version has queued another job that is still pending, so nothing is lost.
- A job can be lost (worker stopped mid-job, failed job). Then `seq > last_versioned_seq` and no write will ever queue again. The daily command queues a job, without delay, for every board in that state whose last change is more than an hour old.
- Automatic versions keep being stored while private writing is on; they hold the real text and are readable only after the reveal (Task 5).

- [ ] **Step 1: Write the failing test**

`tests/Feature/Whiteboards/WhiteboardAutomaticVersionsTest.php`:

```php
<?php

use App\Actions\Whiteboards\CreateWhiteboard;
use App\Events\Whiteboards\WhiteboardChanged;
use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Exceptions\WhiteboardQueryFailed;
use App\Jobs\StoreAutomaticWhiteboardVersion;
use App\Models\Team;
use App\Models\Whiteboard;
use App\Models\WhiteboardFile;
use App\Models\WhiteboardVersion;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Queue::fake();
    Storage::fake();
    Event::fake([WhiteboardElementsChanged::class, WhiteboardChanged::class]);
    $this->travelTo('2026-10-12 10:00:00');
});

function runAutomaticVersionJob(Whiteboard $board): void
{
    app()->call([new StoreAutomaticWhiteboardVersion($board->id), 'handle']);
}

it('schedules a version five minutes after the first write, and only one', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    putWhiteboardElements($this->actingAs($user), $board, [sceneElement(['id' => 'first'])])->assertOk();
    putWhiteboardElements($this->actingAs($user), $board, [sceneElement(['id' => 'second'])])->assertOk();

    Queue::assertPushed(StoreAutomaticWhiteboardVersion::class, 1);
    Queue::assertPushed(
        StoreAutomaticWhiteboardVersion::class,
        fn (StoreAutomaticWhiteboardVersion $job) => $job->boardId === $board->id
            && $job->delay instanceof DateTimeInterface
            && CarbonImmutable::instance($job->delay)->equalTo(CarbonImmutable::parse('2026-10-12 10:05:00')),
    );
});

it('schedules nothing for a write that changes nothing', function () {
    $board = Whiteboard::factory()->create(['seq' => 1, 'last_versioned_seq' => 1]);
    [$user, $member] = whiteboardMember($board);
    storeWhiteboardElement($board, sceneElement(['id' => 'box', 'version' => 3]), 1, $member);

    putWhiteboardElements($this->actingAs($user), $board, [sceneElement(['id' => 'box', 'version' => 2])])
        ->assertJsonPath('rejected.0.reason', 'stale');

    Queue::assertNothingPushed();
});

it('stores the live scene with its real text and remembers how far it goes', function () {
    $board = Whiteboard::factory()->privateWriting()->create(['seq' => 4, 'last_versioned_seq' => 1]);
    [, $member] = whiteboardMember($board);
    $file = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);
    [$note, $text] = stickyWithText('note', 'Secret idea 7391');
    storeWhiteboardElement($board, [...$note, 'index' => 'a2'], 1, $member, private: true);
    storeWhiteboardElement($board, [...$text, 'index' => 'a3'], 2, $member, private: true);
    storeWhiteboardElement($board, sceneElement(['id' => 'photo', 'type' => 'image', 'fileId' => $file->file_id, 'status' => 'saved', 'scale' => [1, 1], 'index' => 'a1']), 3, $member);
    storeWhiteboardElement($board, sceneElement(['id' => 'erased', 'index' => 'a4', 'isDeleted' => true]), 4, $member);
    $changedAt = $board->fresh()->updated_at;

    $this->travelTo('2026-10-12 10:05:00');
    runAutomaticVersionJob($board);

    $version = $board->versions()->sole();

    expect($version->name)->toBeNull()
        ->and($version->created_by_member_id)->toBeNull()
        ->and($version->seq)->toBe(4)
        ->and($version->created_at->toDateTimeString())->toBe('2026-10-12 10:05:00')
        ->and(array_column($version->scene['elements'], 'id'))->toBe(['photo', 'note', 'note-text'])
        ->and($version->scene['elements'][2]['text'])->toBe('Secret idea 7391')
        ->and($version->scene['fileIds'])->toBe([$file->file_id])
        ->and($board->fresh()->last_versioned_seq)->toBe(4)
        ->and($board->fresh()->updated_at->equalTo($changedAt))->toBeTrue();
});

it('stores nothing when nothing changed since the last version, or when the board is gone', function () {
    $board = Whiteboard::factory()->create(['seq' => 3, 'last_versioned_seq' => 3]);

    runAutomaticVersionJob($board);

    expect(WhiteboardVersion::query()->count())->toBe(0);

    $board->delete();
    runAutomaticVersionJob($board);

    expect(WhiteboardVersion::query()->count())->toBe(0);
});

it('stores at most one automatic version every five minutes', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    putWhiteboardElements($this->actingAs($user), $board, [sceneElement(['id' => 'box'])])->assertOk();

    $this->travelTo('2026-10-12 10:05:00');
    runAutomaticVersionJob($board);

    $this->travelTo('2026-10-12 10:06:00');
    putWhiteboardElements($this->actingAs($user), $board, [sceneElement(['id' => 'box', 'version' => 2])])->assertOk();
    runAutomaticVersionJob($board);

    expect($board->versions()->count())->toBe(1);
    Queue::assertPushed(StoreAutomaticWhiteboardVersion::class, 2);

    $this->travelTo('2026-10-12 10:11:00');
    runAutomaticVersionJob($board);

    expect($board->versions()->pluck('seq')->sort()->values()->all())->toBe([1, 2])
        ->and($board->fresh()->last_versioned_seq)->toBe(2);
});

it('keeps the last fifty automatic versions and every named one', function () {
    $board = Whiteboard::factory()->create(['seq' => 60, 'last_versioned_seq' => 50]);

    foreach (range(1, 50) as $seq) {
        WhiteboardVersion::factory()->create([
            'whiteboard_id' => $board->id,
            'seq' => $seq,
            'created_at' => now()->subHours(60 - $seq),
        ]);
    }

    $named = WhiteboardVersion::factory()->named('Kick-off')->create([
        'whiteboard_id' => $board->id,
        'seq' => 0,
        'created_at' => now()->subDays(9),
    ]);
    $elsewhere = WhiteboardVersion::factory()->create(['seq' => 1, 'created_at' => now()->subDays(9)]);

    runAutomaticVersionJob($board);

    expect($board->versions()->whereNull('name')->pluck('seq')->sort()->values()->all())->toBe([...range(2, 50), 60])
        ->and($board->versions()->whereKey($named->id)->exists())->toBeTrue()
        ->and($elsewhere->fresh())->not->toBeNull();
});

it('schedules the first version of a board created from a scene', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $board = app(CreateWhiteboard::class)->handle($team, $user, 'From a template', [
        'elements' => [sceneElement(['id' => 'shape'])],
        'files' => [],
    ]);

    putWhiteboardElements($this->actingAs($user), $board, [sceneElement(['id' => 'added', 'index' => 'a5'])])->assertOk();

    Queue::assertPushed(StoreAutomaticWhiteboardVersion::class, fn (StoreAutomaticWhiteboardVersion $job) => $job->boardId === $board->id);
});

it('schedules a version when a reveal is the first change since the last one', function () {
    $table = privateWritingBoard();
    $table['board']->update(['last_versioned_seq' => 2]);

    $this->actingAs($table['facilitator'])
        ->patchJson(route('whiteboards.settings.update', $table['board']), ['private_writing' => false])
        ->assertNoContent();

    Queue::assertPushed(StoreAutomaticWhiteboardVersion::class, 1);
});

it('queues the versions a lost job never stored', function () {
    $stuck = Whiteboard::factory()->create(['seq' => 5, 'last_versioned_seq' => 2]);
    $versioned = Whiteboard::factory()->create(['seq' => 5, 'last_versioned_seq' => 5]);
    $busy = Whiteboard::factory()->create(['seq' => 5, 'last_versioned_seq' => 2]);

    Whiteboard::query()->whereKey([$stuck->id, $versioned->id])->toBase()->update(['updated_at' => now()->subHours(2)]);
    Whiteboard::query()->whereKey($busy->id)->toBase()->update(['updated_at' => now()->subMinutes(10)]);

    $this->artisan('skrum:prune-whiteboards')->assertSuccessful();

    Queue::assertPushed(StoreAutomaticWhiteboardVersion::class, 1);
    Queue::assertPushed(
        StoreAutomaticWhiteboardVersion::class,
        fn (StoreAutomaticWhiteboardVersion $job) => $job->boardId === $stuck->id && $job->delay === null,
    );
});

it('keeps an image for as long as a version shows it', function () {
    $board = Whiteboard::factory()->create();

    $this->travelTo('2026-10-11 08:00:00');
    $file = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);
    $this->travelTo('2026-10-12 10:00:00');

    Storage::put($file->path, 'bytes');

    $version = WhiteboardVersion::factory()->create([
        'whiteboard_id' => $board->id,
        'scene' => [
            'elements' => [sceneElement(['id' => 'photo', 'type' => 'image', 'fileId' => $file->file_id, 'status' => 'saved', 'scale' => [1, 1]])],
            'fileIds' => [$file->file_id],
        ],
    ]);

    $this->artisan('skrum:prune-whiteboards')->assertSuccessful();

    Storage::assertExists($file->path);
    expect($file->fresh())->not->toBeNull();

    $version->delete();

    $this->artisan('skrum:prune-whiteboards')->assertSuccessful();

    Storage::assertMissing($file->path);
    expect($file->fresh())->toBeNull();
});

it('keeps the scene out of the log when a version cannot be stored', function () {
    $table = privateWritingBoard();

    DB::statement('alter table whiteboard_versions add constraint whiteboard_versions_refused check (seq < 0)');

    $failure = null;

    try {
        runAutomaticVersionJob($table['board']);
    } catch (Throwable $exception) {
        $failure = $exception;
    }

    expect($failure)->toBeInstanceOf(WhiteboardQueryFailed::class)
        ->and($failure->getPrevious())->toBeNull()
        ->and(whiteboardPayloadExposes($failure->getMessage(), $table['secret']))->toBeFalse()
        ->and(WhiteboardVersion::query()->count())->toBe(0);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards/WhiteboardAutomaticVersionsTest.php`
Expected: FAIL — `Class "App\Jobs\StoreAutomaticWhiteboardVersion" not found`.

- [ ] **Step 3: Store a version**

`app/Actions/Whiteboards/StoreWhiteboardVersion.php`:

```php
<?php

namespace App\Actions\Whiteboards;

use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardVersion;

/**
 * @phpstan-import-type VersionScene from WhiteboardVersion
 */
class StoreWhiteboardVersion
{
    public function __construct(
        private ReadWhiteboardScene $readWhiteboardScene,
        private KeepWhiteboardTextOutOfLogs $keepWhiteboardTextOutOfLogs,
    ) {}

    /**
     * The caller holds the lock on the board row. A null name is an
     * automatic version; the cap of named versions is the caller's concern.
     */
    public function handle(Whiteboard $locked, ?WhiteboardMember $member, ?string $name): WhiteboardVersion
    {
        $elements = $this->readWhiteboardScene->handle($locked)['elements'];

        $version = $this->keepWhiteboardTextOutOfLogs->handle($locked->id, fn (): WhiteboardVersion => $locked->versions()->create([
            'name' => $name,
            'scene' => ['elements' => $elements, 'fileIds' => $this->fileIds($elements)],
            'seq' => $locked->seq,
            'created_by_member_id' => $member?->id,
        ]));

        $this->rememberHowFar($locked);

        if ($name === null) {
            $this->forgetOldAutomaticVersions($locked);
        }

        return $version;
    }

    /**
     * @param  list<array<string, mixed>>  $elements
     * @return list<string>
     */
    private function fileIds(array $elements): array
    {
        return collect($elements)
            ->where('type', 'image')
            ->pluck('fileId')
            ->filter(fn (mixed $fileId): bool => is_string($fileId))
            ->unique()
            ->values()
            ->all();
    }

    /**
     * Written through the base query: `updated_at` is the sort key of the
     * team page and a version is not a change of the board.
     */
    private function rememberHowFar(Whiteboard $locked): void
    {
        Whiteboard::query()->whereKey($locked->id)->toBase()->update(['last_versioned_seq' => $locked->seq]);

        $locked->last_versioned_seq = $locked->seq;
        $locked->syncOriginalAttribute('last_versioned_seq');
    }

    private function forgetOldAutomaticVersions(Whiteboard $locked): void
    {
        $kept = $locked->versions()
            ->whereNull('name')
            ->orderByDesc('seq')
            ->orderByDesc('created_at')
            ->limit(WhiteboardVersion::KeptAutomatic)
            ->pluck('id');

        $locked->versions()->whereNull('name')->whereNotIn('id', $kept)->delete();
    }
}
```

`syncOriginalAttribute` keeps the model in step with the row without marking it dirty, so a later `$locked->update([...])` by the caller does not write the column a second time.

- [ ] **Step 4: The job, the scheduler, the catch-up**

`app/Jobs/StoreAutomaticWhiteboardVersion.php`:

```php
<?php

namespace App\Jobs;

use App\Actions\Whiteboards\StoreWhiteboardVersion;
use App\Models\Whiteboard;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

class StoreAutomaticWhiteboardVersion implements ShouldQueue
{
    use Queueable;

    public const DelayMinutes = 5;

    public function __construct(public string $boardId) {}

    /**
     * The job carries the board only: what it stores is decided when it
     * runs, under the lock. A younger automatic version means another job,
     * queued by the write that followed it, is still due.
     */
    public function handle(StoreWhiteboardVersion $storeWhiteboardVersion): void
    {
        DB::transaction(function () use ($storeWhiteboardVersion): void {
            $locked = Whiteboard::query()->whereKey($this->boardId)->lockForUpdate()->first();

            if ($locked === null || $locked->seq <= $locked->last_versioned_seq) {
                return;
            }

            $hasYoungVersion = $locked->versions()
                ->whereNull('name')
                ->where('created_at', '>', now()->subMinutes(self::DelayMinutes))
                ->exists();

            if ($hasYoungVersion) {
                return;
            }

            $storeWhiteboardVersion->handle($locked, null, null);
        });
    }
}
```

`app/Actions/Whiteboards/ScheduleWhiteboardVersion.php`:

```php
<?php

namespace App\Actions\Whiteboards;

use App\Jobs\StoreAutomaticWhiteboardVersion;
use App\Models\Whiteboard;

class ScheduleWhiteboardVersion
{
    /**
     * Call inside the board lock after a change of `seq`, with the seq the
     * change started from: the first change after the last version queues
     * the next one, the following ones find it already queued.
     */
    public function handle(Whiteboard $locked, int $fromSeq): void
    {
        if ($fromSeq !== $locked->last_versioned_seq) {
            return;
        }

        StoreAutomaticWhiteboardVersion::dispatch($locked->id)
            ->delay(now()->addMinutes(StoreAutomaticWhiteboardVersion::DelayMinutes))
            ->afterCommit();
    }
}
```

`app/Actions/Whiteboards/QueueMissedWhiteboardVersions.php`:

```php
<?php

namespace App\Actions\Whiteboards;

use App\Jobs\StoreAutomaticWhiteboardVersion;
use App\Models\Whiteboard;

/**
 * A board with changes no version holds, untouched for an hour: the job
 * that should have stored them is gone and no write will queue another.
 */
class QueueMissedWhiteboardVersions
{
    private const IdleHours = 1;

    public function handle(): int
    {
        return Whiteboard::query()
            ->whereColumn('seq', '>', 'last_versioned_seq')
            ->where('updated_at', '<', now()->subHours(self::IdleHours))
            ->pluck('id')
            ->each(fn (string $boardId) => StoreAutomaticWhiteboardVersion::dispatch($boardId))
            ->count();
    }
}
```

In `app/Console/Commands/PruneWhiteboardsCommand.php`: change `$description` to `'Remove expired whiteboard tombstones and unused images, and queue missed versions'`, add `QueueMissedWhiteboardVersions $queueMissedWhiteboardVersions` to `handle()` and, before `return self::SUCCESS;`:

```php
        $this->info('Queuing missed versions...');

        $versions = $queueMissedWhiteboardVersions->handle();

        $this->comment("Queued {$versions} versions.");
```

- [ ] **Step 5: Schedule from every change of `seq`**

In `app/Actions/Whiteboards/WriteWhiteboardElements.php`: add `private ScheduleWhiteboardVersion $scheduleWhiteboardVersion,` to the constructor and, right after `$locked->update(['seq' => $seq]);`:

```php
            $this->scheduleWhiteboardVersion->handle($locked, $fromSeq);
```

(That line is only reached when `seq` moved: the early return for an unchanged `seq` is above it.)

In `app/Actions/Whiteboards/SetWhiteboardPrivateWriting.php`: add a constructor `public function __construct(private ScheduleWhiteboardVersion $scheduleWhiteboardVersion) {}` and, in `reveal()`, after `$locked->update(['private_writing' => false, 'seq' => $seq]);`:

```php
        $this->scheduleWhiteboardVersion->handle($locked, $fromSeq);
```

- [ ] **Step 6: A version keeps its images**

In `app/Actions/Whiteboards/PruneWhiteboardFiles.php` replace `isUsed()` and its docblock:

```php
    /**
     * A file lives while a live element or a version of its board shows it
     * (spec §6.5). A template keeps its own copy of every image.
     */
    private function isUsed(WhiteboardFile $file): bool
    {
        $shownOnTheBoard = WhiteboardElement::query()
            ->where('whiteboard_id', $file->whiteboard_id)
            ->where('type', 'image')
            ->where('is_deleted', false)
            ->where('data->fileId', $file->file_id)
            ->exists();

        if ($shownOnTheBoard) {
            return true;
        }

        return WhiteboardVersion::query()
            ->where('whiteboard_id', $file->whiteboard_id)
            ->whereJsonContains('scene->fileIds', $file->file_id)
            ->exists();
    }
```

(import `App\Models\WhiteboardVersion`). `scene->fileIds` is why a version stores the ids of its images beside its elements: the question "does any version show this file" does not have to read the elements of every version.

- [ ] **Step 7: Run the tests**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards`
Expected: PASS. From now on every test that writes to a board whose `seq` equals `last_versioned_seq` runs the job at once (the test queue is synchronous) and stores one version; no earlier test counts versions, and `privateWritingBoard()` never triggers it (`seq` 2, `last_versioned_seq` 0).

- [ ] **Step 8: Gates and commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/phpstan analyse --memory-limit=1G app/Actions/Whiteboards/StoreWhiteboardVersion.php app/Actions/Whiteboards/ScheduleWhiteboardVersion.php app/Actions/Whiteboards/QueueMissedWhiteboardVersions.php app/Jobs/StoreAutomaticWhiteboardVersion.php app/Actions/Whiteboards/WriteWhiteboardElements.php app/Actions/Whiteboards/SetWhiteboardPrivateWriting.php app/Actions/Whiteboards/PruneWhiteboardFiles.php app/Console/Commands/PruneWhiteboardsCommand.php
git add app/Actions/Whiteboards/StoreWhiteboardVersion.php app/Actions/Whiteboards/ScheduleWhiteboardVersion.php app/Actions/Whiteboards/QueueMissedWhiteboardVersions.php app/Jobs/StoreAutomaticWhiteboardVersion.php app/Actions/Whiteboards/WriteWhiteboardElements.php app/Actions/Whiteboards/SetWhiteboardPrivateWriting.php app/Actions/Whiteboards/PruneWhiteboardFiles.php app/Console/Commands/PruneWhiteboardsCommand.php tests/Feature/Whiteboards/WhiteboardAutomaticVersionsTest.php
git commit -m "feat(whiteboard): automatic versions every five minutes of activity"
```

**UI strings added by this task:** none.

---

### Task 5: Version endpoints — list, save, preview, rename, delete

**Files:**
- Create: `app/Actions/Whiteboards/PresentWhiteboardVersion.php`, `app/Http/Controllers/Whiteboards/WhiteboardVersionsController.php`
- Modify: `routes/web.php`, `lang/{en,fr,de,es}.json`
- Test: `tests/Feature/Whiteboards/WhiteboardVersionsTest.php`

**Interfaces:**
- Consumes: `StoreWhiteboardVersion::handle(Whiteboard $locked, ?WhiteboardMember $member, ?string $name): WhiteboardVersion` (Task 4); `WhiteboardGuard::notGuest`, `::facilitator`, `::notPrivateWriting` (Task 3); `WhiteboardVersion::MaxNamed`; `WhiteboardMember::current(Request)`; route `whiteboards.files.show`.
- Produces — routes in the `whiteboards/{board}` group (`{version}` is bound to `WhiteboardVersion` and scoped to the board by `scopeBindings()` through `Whiteboard::versions()`):

| Method | Path | Name | Who | Response |
|---|---|---|---|---|
| GET | `versions` | `whiteboards.versions.index` | non-guest member | 200, a JSON array of `VersionSummary`, newest first |
| POST | `versions` | `whiteboards.versions.store` | non-guest member | 201, the `VersionSummary` |
| GET | `versions/{version}` | `whiteboards.versions.show` | non-guest member | 200 `{elements: [...], files: [{id, url, mimeType}]}` |
| PATCH | `versions/{version}` | `whiteboards.versions.update` | facilitator | 204 |
| DELETE | `versions/{version}` | `whiteboards.versions.destroy` | facilitator | 204 |

  - `PresentWhiteboardVersion::handle(WhiteboardVersion $version): array{id: string, name: ?string, createdAt: string, createdByName: ?string, automatic: bool}` (`VersionSummary`).

**Rules** (spec §9):
- A guest gets 403 "Guests cannot do this." on every endpoint, before any other answer.
- List and preview answer 422 "Reveal the notes first." while private writing is on. Saving, renaming and deleting stay allowed: they return no content of a scene.
- Save: `name` required, 1–80 characters (trimmed by the framework). At most 100 named versions per board: 422 "This board already has 100 saved versions.". Saving sets `last_versioned_seq`.
- Rename: `name` 1–80. Naming an automatic version makes it a named one: it leaves the rotation of the 50 automatic versions and counts in the 100, so the cap is checked. Delete: any version.
- Preview returns the stored elements as they are (after the reveal nothing is private) and, in `files`, the images of the version that the board still stores.
- No broadcast: the history panel fetches the list when it opens.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Whiteboards/WhiteboardVersionsTest.php`:

```php
<?php

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardFile;
use App\Models\WhiteboardVersion;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Queue::fake();
    Storage::fake();
    $this->travelTo('2026-10-12 10:00:00');
});

it('lists the versions of a board, newest first, without their scenes', function () {
    $board = Whiteboard::factory()->create();
    [$user, $member] = whiteboardMember($board);
    $automatic = WhiteboardVersion::factory()->create(['whiteboard_id' => $board->id, 'seq' => 3, 'created_at' => now()->subHour()]);
    $named = WhiteboardVersion::factory()->named('Kick-off')->create([
        'whiteboard_id' => $board->id,
        'seq' => 5,
        'created_by_member_id' => $member->id,
        'scene' => ['elements' => [sceneElement(['id' => 'kept'])], 'fileIds' => []],
    ]);
    WhiteboardVersion::factory()->named('Elsewhere')->create();

    $this->actingAs($user)
        ->getJson(route('whiteboards.versions.index', $board))
        ->assertOk()
        ->assertExactJson([
            ['id' => $named->id, 'name' => 'Kick-off', 'createdAt' => now()->toIso8601String(), 'createdByName' => $user->name, 'automatic' => false],
            ['id' => $automatic->id, 'name' => null, 'createdAt' => now()->subHour()->toIso8601String(), 'createdByName' => null, 'automatic' => true],
        ]);
});

it('saves a named version of the live scene for any member', function () {
    $board = Whiteboard::factory()->create(['seq' => 2]);
    whiteboardFacilitator($board);
    [$user, $member] = whiteboardMember($board);
    storeWhiteboardElement($board, sceneElement(['id' => 'box']), 1, $member);
    storeWhiteboardElement($board, sceneElement(['id' => 'erased', 'index' => 'a1', 'isDeleted' => true]), 2, $member);
    $changedAt = $board->fresh()->updated_at;

    $response = $this->actingAs($user)
        ->postJson(route('whiteboards.versions.store', $board), ['name' => '  Before the vote  '])
        ->assertCreated();

    $version = $board->versions()->sole();

    $response->assertExactJson([
        'id' => $version->id,
        'name' => 'Before the vote',
        'createdAt' => now()->toIso8601String(),
        'createdByName' => $user->name,
        'automatic' => false,
    ]);

    expect($version->seq)->toBe(2)
        ->and($version->created_by_member_id)->toBe($member->id)
        ->and(array_column($version->scene['elements'], 'id'))->toBe(['box'])
        ->and($version->scene['fileIds'])->toBe([])
        ->and($board->fresh()->last_versioned_seq)->toBe(2)
        ->and($board->fresh()->updated_at->equalTo($changedAt))->toBeTrue();
});

it('validates the name of a version', function (array $body) {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    $this->actingAs($user)
        ->postJson(route('whiteboards.versions.store', $board), $body)
        ->assertJsonValidationErrors('name');

    expect($board->versions()->count())->toBe(0);
})->with([
    'missing' => [[]],
    'empty' => [['name' => '   ']],
    'too long' => [['name' => str_repeat('a', 81)]],
    'not a string' => [['name' => ['x']]],
]);

it('stops at one hundred named versions, whatever the number of automatic ones', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    WhiteboardVersion::factory()->count(99)->named()->create(['whiteboard_id' => $board->id]);
    WhiteboardVersion::factory()->count(3)->create(['whiteboard_id' => $board->id]);

    $this->actingAs($user)->postJson(route('whiteboards.versions.store', $board), ['name' => 'Hundredth'])->assertCreated();

    $this->actingAs($user)
        ->postJson(route('whiteboards.versions.store', $board), ['name' => 'One too many'])
        ->assertStatus(422)
        ->assertJsonPath('message', 'This board already has 100 saved versions.');

    expect($board->versions()->whereNotNull('name')->count())->toBe(100);
});

it('previews a version: its elements and the images the board still stores', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    $file = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);
    [$note, $text] = stickyWithText('note', 'Remembered');
    $version = WhiteboardVersion::factory()->create([
        'whiteboard_id' => $board->id,
        'scene' => [
            'elements' => [
                $note,
                $text,
                sceneElement(['id' => 'photo', 'type' => 'image', 'fileId' => $file->file_id, 'status' => 'saved', 'scale' => [1, 1], 'index' => 'a3']),
                sceneElement(['id' => 'lost', 'type' => 'image', 'fileId' => 'gone-file', 'status' => 'saved', 'scale' => [1, 1], 'index' => 'a4']),
            ],
            'fileIds' => [$file->file_id, 'gone-file'],
        ],
    ]);

    $this->actingAs($user)
        ->getJson(route('whiteboards.versions.show', [$board, $version]))
        ->assertOk()
        ->assertJsonPath('elements.*.id', ['note', 'note-text', 'photo', 'lost'])
        ->assertJsonPath('elements.1.text', 'Remembered')
        ->assertJsonPath('files', [[
            'id' => $file->file_id,
            'url' => route('whiteboards.files.show', [$board, $file->file_id], absolute: false),
            'mimeType' => 'image/png',
        ]]);
});

it('lets the facilitator rename and delete a version, and no one else', function () {
    $board = Whiteboard::factory()->create();
    [$facilitator] = whiteboardFacilitator($board);
    [$member] = whiteboardMember($board);
    $version = WhiteboardVersion::factory()->named('Draft')->create(['whiteboard_id' => $board->id]);

    $this->actingAs($member)->patchJson(route('whiteboards.versions.update', [$board, $version]), ['name' => 'Mine'])->assertForbidden();
    $this->actingAs($member)->deleteJson(route('whiteboards.versions.destroy', [$board, $version]))->assertForbidden();

    $this->actingAs($facilitator)
        ->patchJson(route('whiteboards.versions.update', [$board, $version]), ['name' => str_repeat('a', 81)])
        ->assertJsonValidationErrors('name');

    $this->actingAs($facilitator)
        ->patchJson(route('whiteboards.versions.update', [$board, $version]), ['name' => 'Final'])
        ->assertNoContent();

    expect($version->fresh()->name)->toBe('Final');

    $this->actingAs($facilitator)->deleteJson(route('whiteboards.versions.destroy', [$board, $version]))->assertNoContent();

    expect($board->versions()->count())->toBe(0);
});

it('turns an automatic version into a named one when the facilitator names it, within the cap', function () {
    $board = Whiteboard::factory()->create();
    [$facilitator] = whiteboardFacilitator($board);
    WhiteboardVersion::factory()->count(99)->named()->create(['whiteboard_id' => $board->id]);
    [$first, $second] = WhiteboardVersion::factory()->count(2)->create(['whiteboard_id' => $board->id]);
    $named = $board->versions()->whereNotNull('name')->firstOrFail();

    $this->actingAs($facilitator)
        ->patchJson(route('whiteboards.versions.update', [$board, $first]), ['name' => 'Worth keeping'])
        ->assertNoContent();

    $this->actingAs($facilitator)
        ->patchJson(route('whiteboards.versions.update', [$board, $second]), ['name' => 'One too many'])
        ->assertStatus(422)
        ->assertJsonPath('message', 'This board already has 100 saved versions.');

    $this->actingAs($facilitator)
        ->patchJson(route('whiteboards.versions.update', [$board, $named]), ['name' => 'Renamed at the cap'])
        ->assertNoContent();

    expect($first->fresh()->isAutomatic())->toBeFalse()
        ->and($second->fresh()->isAutomatic())->toBeTrue()
        ->and($named->fresh()->name)->toBe('Renamed at the cap');
});

it('refuses guests on every version endpoint', function (string $method, string $route, bool $onVersion, array $body) {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    whiteboardFacilitator($board);
    $guest = whiteboardGuest($board);
    $version = WhiteboardVersion::factory()->named()->create(['whiteboard_id' => $board->id]);

    whiteboardViewer($this, $guest)
        ->json($method, route($route, $onVersion ? [$board, $version] : [$board]), $body)
        ->assertForbidden()
        ->assertJsonPath('message', 'Guests cannot do this.');

    expect($board->versions()->count())->toBe(1)
        ->and($version->fresh()->name)->toBe('Checkpoint');
})->with([
    'list' => ['GET', 'whiteboards.versions.index', false, []],
    'save' => ['POST', 'whiteboards.versions.store', false, ['name' => 'Mine']],
    'preview' => ['GET', 'whiteboards.versions.show', true, []],
    'rename' => ['PATCH', 'whiteboards.versions.update', true, ['name' => 'Mine']],
    'delete' => ['DELETE', 'whiteboards.versions.destroy', true, []],
]);

it('refuses people outside the team, logged-out visitors and versions of another board', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    $version = WhiteboardVersion::factory()->named()->create(['whiteboard_id' => $board->id]);
    $foreign = WhiteboardVersion::factory()->named()->create();

    $this->getJson(route('whiteboards.versions.index', $board))->assertUnauthorized();

    $outsider = User::factory()->create();
    $board->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)->getJson(route('whiteboards.versions.index', $board))->assertForbidden();
    $this->actingAs($outsider)->getJson(route('whiteboards.versions.show', [$board, $version]))->assertForbidden();

    $this->actingAs($user)->getJson(route('whiteboards.versions.show', [$board, $foreign]))->assertNotFound();
    $this->actingAs($user)->deleteJson(route('whiteboards.versions.destroy', [$board, $foreign]))->assertNotFound();
});

it('keeps the history closed while the notes are hidden', function (string $viewer) {
    $table = privateWritingBoard();
    $board = $table['board'];
    [$note, $text] = stickyWithText('note', $table['secret']);
    $version = WhiteboardVersion::factory()->create([
        'whiteboard_id' => $board->id,
        'scene' => ['elements' => [$note, $text], 'fileIds' => []],
    ]);

    $list = $this->actingAs($table[$viewer])
        ->getJson(route('whiteboards.versions.index', $board))
        ->assertStatus(422)
        ->assertJsonPath('message', 'Reveal the notes first.');

    $preview = $this->actingAs($table[$viewer])
        ->getJson(route('whiteboards.versions.show', [$board, $version]))
        ->assertStatus(422)
        ->assertJsonPath('message', 'Reveal the notes first.');

    $saved = $this->actingAs($table[$viewer])
        ->postJson(route('whiteboards.versions.store', $board), ['name' => 'While hidden'])
        ->assertCreated();

    expect(whiteboardPayloadExposes($list->getContent().$preview->getContent().$saved->getContent(), $table['secret']))->toBeFalse()
        ->and(whiteboardPayloadExposes($board->versions()->whereNotNull('name')->sole()->scene, $table['secret']))->toBeTrue();
})->with([
    'another member' => 'other',
    'the facilitator' => 'facilitator',
    'the author' => 'author',
]);
```

- [ ] **Step 2: Run it to see it fail**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards/WhiteboardVersionsTest.php`
Expected: FAIL — `Route [whiteboards.versions.index] not defined`.

- [ ] **Step 3: Presenter**

`app/Actions/Whiteboards/PresentWhiteboardVersion.php`:

```php
<?php

namespace App\Actions\Whiteboards;

use App\Models\WhiteboardVersion;

/**
 * A version as the history panel lists it: never its scene.
 *
 * @phpstan-type VersionSummary array{id: string, name: ?string, createdAt: string, createdByName: ?string, automatic: bool}
 */
class PresentWhiteboardVersion
{
    /**
     * @return VersionSummary
     */
    public function handle(WhiteboardVersion $version): array
    {
        return [
            'id' => $version->id,
            'name' => $version->name,
            'createdAt' => $version->created_at->toIso8601String(),
            'createdByName' => $version->createdBy?->displayName(),
            'automatic' => $version->isAutomatic(),
        ];
    }
}
```

- [ ] **Step 4: Controller**

`app/Http/Controllers/Whiteboards/WhiteboardVersionsController.php`:

```php
<?php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\PresentWhiteboardVersion;
use App\Actions\Whiteboards\StoreWhiteboardVersion;
use App\Actions\Whiteboards\WhiteboardGuard;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardFile;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardVersion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class WhiteboardVersionsController extends Controller
{
    private const NameRules = ['required', 'string', 'max:80'];

    public function index(Request $request, Whiteboard $board, PresentWhiteboardVersion $presentWhiteboardVersion): JsonResponse
    {
        WhiteboardGuard::notGuest(WhiteboardMember::current($request));
        WhiteboardGuard::notPrivateWriting($board);

        return response()->json(
            $board->versions()
                ->with('createdBy.user')
                ->orderByDesc('created_at')
                ->orderByDesc('seq')
                ->orderByDesc('id')
                ->get()
                ->map(fn (WhiteboardVersion $version): array => $presentWhiteboardVersion->handle($version))
                ->all(),
        );
    }

    public function store(
        Request $request,
        Whiteboard $board,
        StoreWhiteboardVersion $storeWhiteboardVersion,
        PresentWhiteboardVersion $presentWhiteboardVersion,
    ): JsonResponse {
        $member = WhiteboardMember::current($request);

        WhiteboardGuard::notGuest($member);

        $validated = $request->validate(['name' => self::NameRules]);

        $version = DB::transaction(function () use ($board, $member, $validated, $storeWhiteboardVersion): WhiteboardVersion {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            $this->ensureRoomForNamedVersion($locked);

            return $storeWhiteboardVersion->handle($locked, $member, $validated['name']);
        });

        return response()->json($presentWhiteboardVersion->handle($version), 201);
    }

    public function show(Request $request, Whiteboard $board, WhiteboardVersion $version): JsonResponse
    {
        WhiteboardGuard::notGuest(WhiteboardMember::current($request));
        WhiteboardGuard::notPrivateWriting($board);

        return response()->json([
            'elements' => $version->scene['elements'],
            'files' => $board->files()
                ->whereIn('file_id', $version->scene['fileIds'])
                ->orderBy('file_id')
                ->get()
                ->map(fn (WhiteboardFile $file): array => [
                    'id' => $file->file_id,
                    'url' => route('whiteboards.files.show', [$board, $file->file_id], absolute: false),
                    'mimeType' => $file->mime_type,
                ])
                ->all(),
        ]);
    }

    public function update(Request $request, Whiteboard $board, WhiteboardVersion $version): Response
    {
        $member = WhiteboardMember::current($request);

        WhiteboardGuard::notGuest($member);
        WhiteboardGuard::facilitator($board, $member);

        $validated = $request->validate(['name' => self::NameRules]);

        DB::transaction(function () use ($board, $member, $version, $validated): void {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            WhiteboardGuard::facilitator($locked, $member);

            $chosen = $locked->versions()->whereKey($version->id)->firstOrFail();

            if ($chosen->isAutomatic()) {
                $this->ensureRoomForNamedVersion($locked);
            }

            $chosen->update(['name' => $validated['name']]);
        });

        return response()->noContent();
    }

    public function destroy(Request $request, Whiteboard $board, WhiteboardVersion $version): Response
    {
        $member = WhiteboardMember::current($request);

        WhiteboardGuard::notGuest($member);
        WhiteboardGuard::facilitator($board, $member);

        DB::transaction(function () use ($board, $member, $version): void {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            WhiteboardGuard::facilitator($locked, $member);

            $locked->versions()->whereKey($version->id)->delete();
        });

        return response()->noContent();
    }

    private function ensureRoomForNamedVersion(Whiteboard $locked): void
    {
        if ($locked->versions()->whereNotNull('name')->count() < WhiteboardVersion::MaxNamed) {
            return;
        }

        throw ValidationException::withMessages(['name' => __('This board already has 100 saved versions.')]);
    }
}
```

`index` and `show` read `private_writing` from the board bound by the route, outside a lock: they change nothing, and a switch that commits a moment later is the same as a request that arrived a moment earlier. A member row is never deleted in normal use, so `createdBy` is there for every named version; when it is not, `createdByName` is null.

- [ ] **Step 5: Routes**

In `routes/web.php` import `App\Http\Controllers\Whiteboards\WhiteboardVersionsController` and add, at the end of the `whiteboards/{board}` group:

```php
        Route::get('versions', [WhiteboardVersionsController::class, 'index'])->name('whiteboards.versions.index');
        Route::post('versions', [WhiteboardVersionsController::class, 'store'])->name('whiteboards.versions.store');
        Route::get('versions/{version}', [WhiteboardVersionsController::class, 'show'])->name('whiteboards.versions.show')->whereUuid('version');
        Route::patch('versions/{version}', [WhiteboardVersionsController::class, 'update'])->name('whiteboards.versions.update')->whereUuid('version');
        Route::delete('versions/{version}', [WhiteboardVersionsController::class, 'destroy'])->name('whiteboards.versions.destroy')->whereUuid('version');
```

The group already has `scopeBindings()`: `{version}` resolves through `$board->versions()`, so a version of another board is a 404.

- [ ] **Step 6: Translations**

| Key (English) | French | German | Spanish |
|---|---|---|---|
| This board already has 100 saved versions. | Ce tableau a déjà 100 versions enregistrées. | Dieses Board hat bereits 100 gespeicherte Versionen. | Esta pizarra ya tiene 100 versiones guardadas. |
| Guests cannot do this. | exists | exists | exists |
| Reveal the notes first. | added in Task 3 | — | — |

- [ ] **Step 7: Run, gates, commit**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards tests/Feature/TranslationKeysTest.php`
Expected: PASS.

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/phpstan analyse --memory-limit=1G app/Actions/Whiteboards/PresentWhiteboardVersion.php app/Http/Controllers/Whiteboards/WhiteboardVersionsController.php
git add app/Actions/Whiteboards/PresentWhiteboardVersion.php app/Http/Controllers/Whiteboards/WhiteboardVersionsController.php routes/web.php lang/en.json lang/fr.json lang/de.json lang/es.json tests/Feature/Whiteboards/WhiteboardVersionsTest.php
git commit -m "feat(whiteboard): list, save, preview, rename and delete versions"
```

---
### Task 6: Restore a version, copy a version to a new board

**Files:**
- Create: `app/Actions/Whiteboards/RestoreWhiteboardVersion.php`, `app/Actions/Whiteboards/CopyWhiteboardVersion.php`, `app/Http/Controllers/Whiteboards/WhiteboardVersionRestoresController.php`, `app/Http/Controllers/Whiteboards/WhiteboardVersionCopiesController.php`
- Modify: `app/Actions/Whiteboards/DuplicateWhiteboard.php` (`title()` becomes public), `routes/web.php`, `lang/{en,fr,de,es}.json`
- Test: `tests/Feature/Whiteboards/WhiteboardVersionRestoreTest.php`

**Interfaces:**
- Consumes: `StoreWhiteboardVersion::handle(Whiteboard $locked, ?WhiteboardMember $member, ?string $name): WhiteboardVersion`, `ScheduleWhiteboardVersion::handle(Whiteboard $locked, int $fromSeq): void` (Task 4); `KeepWhiteboardTextOutOfLogs::handle` (Task 2); `WhiteboardGuard::notGuest`, `::facilitator`, `::notPrivateWriting`; `SanitizeWhiteboardElement::handle(mixed): ?array`, `SanitizeWhiteboardElement::MaxVersion`; `CreateWhiteboard::handle(Team $team, User $creator, string $title, array $scene): Whiteboard` (scene = `{elements, files: list<{fileId, path, mimeType, size}>}`); `DuplicateWhiteboard::title(string): string`; events `WhiteboardElementsChanged`, `WhiteboardChanged`.
- Produces:
  - `POST whiteboards/{board}/versions/{version}/restore` → `whiteboards.versions.restore.store`, facilitator, 204; `elements.changed` (ids-only) when something changed, then `board.changed`.
  - `POST whiteboards/{board}/versions/{version}/copy` → `whiteboards.versions.copy.store`, non-guest member, 201 `{url}` (relative URL of the new board).
  - `RestoreWhiteboardVersion::handle(Whiteboard $board, WhiteboardMember $member, WhiteboardVersion $version): void`
  - `CopyWhiteboardVersion::handle(Whiteboard $board, User $user, WhiteboardVersion $version): Whiteboard`

**Restore, precisely** (spec §9; one transaction, board row locked, facilitator and `notPrivateWriting` re-checked inside):

1. Store the current scene as a named version "Before restore · {date}" (`StoreWhiteboardVersion`, created by the facilitator). It is not counted against the cap of 100 when it is stored: a restore is never refused because the history is full.
2. Take the elements of the chosen version, in their stored order, through `SanitizeWhiteboardElement`; leave out what it refuses and any image whose file the board no longer stores.
3. An element whose row no longer exists (its tombstone was purged), or whose row is a tombstone already at the highest version number, comes back under a **fresh id**, version 1, and every reference to it inside the restored elements is rewritten (`containerId`, `frameId`, `boundElements[].id`, `startBinding/endBinding.elementId`). Reason: a browser left open for days may still hold the old tombstone at a version the server no longer knows; under the old id the canvas would keep its tombstone (`reconcileElements` keeps the higher version) and write the deletion back.
4. Every other element is written over its row with `version = max(stored, version's) + 1` (at most the highest version number), a new nonce, `isDeleted = false`, `is_private = false`, and the next `seq`. An element whose row is live, carries the same `version` and `versionNonce` as in the version and needs no reference rewritten is left alone: nothing changed since.
5. Every live row that is not part of the restored set becomes a tombstone: `isDeleted = true`, `version + 1`, new nonce, next `seq`.
6. A live row at the highest version number can be neither rewritten nor tombstoned: it is left as it is (a client put it there; the rest of the board is restored).
7. **17c step:** an open voting session is closed without results and every closed, undismissed session is dismissed.
8. `whiteboards.seq` takes the last `seq`; `ScheduleWhiteboardVersion` is called (the "Before restore" version made this the first change after the last version). After commit: `elements.changed` `{seq, fromSeq}` without elements, then `board.changed`.

Indices are those of the version: the restored elements keep the relative order they had. A tombstone may now share an index with a live element; the canvas repairs that and writes the repair back (spec §6.3), which is the existing rule.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Whiteboards/WhiteboardVersionRestoreTest.php`:

```php
<?php

use App\Actions\Whiteboards\SanitizeWhiteboardElement;
use App\Enums\WorkspaceRole;
use App\Events\Whiteboards\WhiteboardChanged;
use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Jobs\StoreAutomaticWhiteboardVersion;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;
use App\Models\WhiteboardVersion;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Queue::fake();
    Storage::fake();
    Event::fake([WhiteboardElementsChanged::class, WhiteboardChanged::class]);
    $this->travelTo('2026-10-12 14:05:00');
});

function restoreVersion(mixed $test, Whiteboard $board, WhiteboardVersion $version): TestResponse
{
    return $test->postJson(route('whiteboards.versions.restore.store', [$board, $version]));
}

/**
 * The live elements of a board without what a restore always changes.
 *
 * @return array<string, array<string, mixed>>
 */
function liveWhiteboardScene(Whiteboard $board): array
{
    return $board->elements()->where('is_deleted', false)->get()
        ->mapWithKeys(fn (WhiteboardElement $element): array => [
            $element->element_id => Arr::except($element->data, ['version', 'versionNonce', 'updated']),
        ])
        ->sortKeys()
        ->all();
}

/**
 * A board that moved on since the version "Monday" was stored: `same` did
 * not change, `moved` moved, `gone` was deleted, `purged` was deleted and
 * its tombstone purged, `label` (bound to `purged`) did not change, `added`
 * is new, `forgotten` was added and deleted.
 *
 * @return array{0: Whiteboard, 1: User, 2: WhiteboardVersion}
 */
function boardWithHistory(): array
{
    $board = Whiteboard::factory()->create(['seq' => 6, 'last_versioned_seq' => 6]);
    [$facilitator, $member] = whiteboardFacilitator($board);

    $same = sceneElement(['id' => 'same', 'index' => 'a1', 'version' => 2]);
    $label = sceneElement([
        'id' => 'label', 'type' => 'text', 'index' => 'a5',
        'text' => 'On the lost shape', 'originalText' => 'On the lost shape', 'containerId' => 'purged',
    ]);

    storeWhiteboardElement($board, $same, 1, $member);
    storeWhiteboardElement($board, sceneElement(['id' => 'moved', 'index' => 'a2', 'version' => 3, 'x' => 500]), 2, $member);
    storeWhiteboardElement($board, sceneElement(['id' => 'gone', 'index' => 'a3', 'version' => 2, 'isDeleted' => true]), 3, $member);
    storeWhiteboardElement($board, $label, 4, $member);
    storeWhiteboardElement($board, sceneElement(['id' => 'added', 'index' => 'a6']), 5, $member);
    storeWhiteboardElement($board, sceneElement(['id' => 'forgotten', 'index' => 'a7', 'isDeleted' => true]), 6, $member);

    $version = WhiteboardVersion::factory()->named('Monday')->create([
        'whiteboard_id' => $board->id,
        'seq' => 2,
        'scene' => [
            'elements' => [
                $same,
                sceneElement(['id' => 'moved', 'index' => 'a2', 'x' => 10]),
                sceneElement(['id' => 'gone', 'index' => 'a3']),
                sceneElement(['id' => 'purged', 'index' => 'a4', 'version' => 5, 'boundElements' => [['id' => 'label', 'type' => 'text']]]),
                $label,
            ],
            'fileIds' => [],
        ],
    ]);

    return [$board, $facilitator, $version];
}

it('rewrites the board from a version and stores the state it replaces first', function () {
    [$board, $facilitator, $version] = boardWithHistory();
    $facilitatorMemberId = $board->fresh()->facilitator_member_id;

    restoreVersion($this->actingAs($facilitator), $board, $version)->assertNoContent();

    $rows = $board->elements()->get()->keyBy('element_id');
    $reborn = $board->elements()->where('seq', 9)->sole();
    $safety = $board->versions()->whereKeyNot($version->id)->sole();

    expect($board->fresh()->seq)->toBe(11)
        ->and($rows['same']->seq)->toBe(1)
        ->and($rows['same']->version)->toBe(2)
        ->and($rows['moved']->seq)->toBe(7)
        ->and($rows['moved']->version)->toBe(4)
        ->and($rows['moved']->data['version'])->toBe(4)
        ->and($rows['moved']->data['x'])->toBe(10)
        ->and($rows['gone']->seq)->toBe(8)
        ->and($rows['gone']->version)->toBe(3)
        ->and($rows['gone']->is_deleted)->toBeFalse()
        ->and($rows['gone']->data['isDeleted'])->toBeFalse()
        ->and($rows->has('purged'))->toBeFalse()
        ->and($reborn->element_id)->not->toBe('purged')
        ->and($reborn->data['id'])->toBe($reborn->element_id)
        ->and($reborn->version)->toBe(1)
        ->and($reborn->author_member_id)->toBe($facilitatorMemberId)
        ->and($reborn->data['boundElements'])->toBe([['id' => 'label', 'type' => 'text']])
        ->and($rows['label']->seq)->toBe(10)
        ->and($rows['label']->version)->toBe(2)
        ->and($rows['label']->data['containerId'])->toBe($reborn->element_id)
        ->and($rows['added']->seq)->toBe(11)
        ->and($rows['added']->version)->toBe(2)
        ->and($rows['added']->is_deleted)->toBeTrue()
        ->and($rows['added']->data['isDeleted'])->toBeTrue()
        ->and($rows['forgotten']->seq)->toBe(6)
        ->and($rows->where('is_private', true)->count())->toBe(0)
        ->and($safety->name)->toStartWith('Before restore · ')
        ->and($safety->created_by_member_id)->toBe($facilitatorMemberId)
        ->and($safety->seq)->toBe(6)
        ->and(array_column($safety->scene['elements'], 'id'))->toBe(['same', 'moved', 'label', 'added'])
        ->and($safety->scene['elements'][1]['x'])->toBe(500)
        ->and($board->fresh()->last_versioned_seq)->toBe(6);

    Event::assertDispatched(
        WhiteboardElementsChanged::class,
        fn (WhiteboardElementsChanged $event) => $event->broadcastWith() === ['seq' => 11, 'fromSeq' => 6],
    );
    Event::assertDispatched(WhiteboardChanged::class);
    Queue::assertPushed(StoreAutomaticWhiteboardVersion::class, 1);

    $this->actingAs($facilitator)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertOk()
        ->assertJsonPath('elements.*.id', ['same', 'moved', 'gone', $reborn->element_id, 'label']);
});

it('can be undone by restoring the version stored before the restore', function () {
    [$board, $facilitator, $version] = boardWithHistory();
    $before = liveWhiteboardScene($board);

    restoreVersion($this->actingAs($facilitator), $board, $version)->assertNoContent();

    $safety = $board->versions()->whereKeyNot($version->id)->sole();

    expect(liveWhiteboardScene($board))->not->toEqual($before);

    restoreVersion($this->actingAs($facilitator), $board, $safety)->assertNoContent();

    expect(liveWhiteboardScene($board))->toEqual($before)
        ->and($board->versions()->count())->toBe(3);
});

it('writes nothing when the board already is the version', function () {
    $board = Whiteboard::factory()->create(['seq' => 1, 'last_versioned_seq' => 1]);
    [$facilitator, $member] = whiteboardFacilitator($board);
    $box = sceneElement(['id' => 'box']);
    storeWhiteboardElement($board, $box, 1, $member);
    $version = WhiteboardVersion::factory()->named()->create(['whiteboard_id' => $board->id, 'scene' => ['elements' => [$box], 'fileIds' => []]]);

    restoreVersion($this->actingAs($facilitator), $board, $version)->assertNoContent();

    expect($board->fresh()->seq)->toBe(1)
        ->and($board->elements()->sole()->version)->toBe(1)
        ->and($board->versions()->count())->toBe(2);

    Event::assertNotDispatched(WhiteboardElementsChanged::class);
    Event::assertDispatched(WhiteboardChanged::class);
});

it('brings back an element whose row is gone under a fresh id', function () {
    $board = Whiteboard::factory()->create();
    [$facilitator] = whiteboardFacilitator($board);
    $version = WhiteboardVersion::factory()->named()->create([
        'whiteboard_id' => $board->id,
        'scene' => [
            'elements' => [
                sceneElement(['id' => 'zone', 'type' => 'frame', 'name' => 'Zone', 'index' => 'a0', 'version' => 9]),
                sceneElement(['id' => 'shape', 'index' => 'a1', 'version' => 40, 'frameId' => 'zone', 'boundElements' => [['id' => 'link', 'type' => 'arrow']]]),
                sceneElement([
                    'id' => 'link', 'type' => 'arrow', 'index' => 'a2', 'points' => [[0, 0], [10, 10]],
                    'startBinding' => ['elementId' => 'shape', 'focus' => 0, 'gap' => 1], 'endBinding' => null,
                ]),
            ],
            'fileIds' => [],
        ],
    ]);

    restoreVersion($this->actingAs($facilitator), $board, $version)->assertNoContent();

    [$zone, $shape, $link] = $board->elements()->orderBy('seq')->get()->all();

    expect(array_intersect([$zone->element_id, $shape->element_id, $link->element_id], ['zone', 'shape', 'link']))->toBe([])
        ->and([$zone->version, $shape->version, $link->version])->toBe([1, 1, 1])
        ->and($zone->data['name'])->toBe('Zone')
        ->and($shape->data['frameId'])->toBe($zone->element_id)
        ->and($shape->data['boundElements'])->toBe([['id' => $link->element_id, 'type' => 'arrow']])
        ->and($link->data['startBinding']['elementId'])->toBe($shape->element_id)
        ->and($link->data['endBinding'])->toBeNull();

    putWhiteboardElements($this->actingAs($facilitator), $board, [
        sceneElement(['id' => 'shape', 'index' => 'a1', 'version' => 41, 'isDeleted' => true]),
    ])->assertOk();

    expect($shape->fresh()->is_deleted)->toBeFalse()
        ->and($board->elements()->where('is_deleted', false)->count())->toBe(3);
});

it('restores the rest when an element sits at the highest version number', function () {
    $highest = SanitizeWhiteboardElement::MaxVersion;
    $board = Whiteboard::factory()->create(['seq' => 4]);
    [$facilitator, $member] = whiteboardFacilitator($board);
    storeWhiteboardElement($board, sceneElement(['id' => 'frozen', 'index' => 'a1', 'version' => $highest, 'x' => 900]), 1, $member);
    storeWhiteboardElement($board, sceneElement(['id' => 'buried', 'index' => 'a2', 'version' => $highest, 'isDeleted' => true]), 2, $member);
    storeWhiteboardElement($board, sceneElement(['id' => 'stuck', 'index' => 'a3', 'version' => $highest]), 3, $member);
    storeWhiteboardElement($board, sceneElement(['id' => 'plain', 'index' => 'a4', 'version' => 2, 'x' => 900]), 4, $member);
    $version = WhiteboardVersion::factory()->named()->create([
        'whiteboard_id' => $board->id,
        'scene' => [
            'elements' => [
                sceneElement(['id' => 'frozen', 'index' => 'a1', 'x' => 1]),
                sceneElement(['id' => 'buried', 'index' => 'a2']),
                sceneElement(['id' => 'plain', 'index' => 'a4', 'x' => 1]),
            ],
            'fileIds' => [],
        ],
    ]);

    restoreVersion($this->actingAs($facilitator), $board, $version)->assertNoContent();

    $rows = $board->elements()->get()->keyBy('element_id');
    $reborn = $board->elements()->where('is_deleted', false)->whereNotIn('element_id', ['frozen', 'stuck', 'plain'])->sole();

    expect($rows['frozen']->data['x'])->toBe(900)
        ->and($rows['frozen']->version)->toBe($highest)
        ->and($rows['buried']->is_deleted)->toBeTrue()
        ->and($rows['stuck']->is_deleted)->toBeFalse()
        ->and($rows['plain']->data['x'])->toBe(1)
        ->and($rows['plain']->version)->toBe(3)
        ->and($reborn->data['index'])->toBe('a2')
        ->and($reborn->version)->toBe(1);
});

it('restores an image the board still stores and leaves out one it lost', function () {
    $board = Whiteboard::factory()->create();
    [$facilitator] = whiteboardFacilitator($board);
    $file = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);
    $version = WhiteboardVersion::factory()->named()->create([
        'whiteboard_id' => $board->id,
        'scene' => [
            'elements' => [
                sceneElement(['id' => 'photo', 'type' => 'image', 'fileId' => $file->file_id, 'status' => 'saved', 'scale' => [1, 1]]),
                sceneElement(['id' => 'lost', 'type' => 'image', 'fileId' => 'gone-file', 'status' => 'saved', 'scale' => [1, 1], 'index' => 'a1']),
            ],
            'fileIds' => [$file->file_id, 'gone-file'],
        ],
    ]);

    restoreVersion($this->actingAs($facilitator), $board, $version)->assertNoContent();

    expect($board->elements()->get()->pluck('data.fileId')->all())->toBe([$file->file_id]);
});

it('only lets the facilitator restore, and never while the notes are hidden', function () {
    [$board, $facilitator, $version] = boardWithHistory();
    [$member] = whiteboardMember($board);
    $board->update(['guest_access_enabled' => true]);
    $guest = whiteboardGuest($board);
    $foreign = WhiteboardVersion::factory()->named()->create();
    $before = liveWhiteboardScene($board);

    restoreVersion($this->actingAs($member), $board, $version)
        ->assertForbidden()
        ->assertJsonPath('message', 'Only the facilitator can do this.');

    restoreVersion(whiteboardViewer($this, $guest), $board, $version)
        ->assertForbidden()
        ->assertJsonPath('message', 'Guests cannot do this.');

    restoreVersion($this->actingAs($facilitator), $board, $foreign)->assertNotFound();

    $board->update(['private_writing' => true]);

    restoreVersion($this->actingAs($facilitator), $board, $version)
        ->assertStatus(422)
        ->assertJsonPath('message', 'Reveal the notes first.');

    expect(liveWhiteboardScene($board))->toEqual($before)
        ->and($board->versions()->count())->toBe(1)
        ->and($board->fresh()->seq)->toBe(6);

    Event::assertNotDispatched(WhiteboardElementsChanged::class);
});

it('stores the state before a restore even when the board has a hundred named versions', function () {
    [$board, $facilitator, $version] = boardWithHistory();
    WhiteboardVersion::factory()->count(99)->named()->create(['whiteboard_id' => $board->id]);

    restoreVersion($this->actingAs($facilitator), $board, $version)->assertNoContent();

    expect($board->versions()->whereNotNull('name')->count())->toBe(101);
});

it('copies a version to a new board of the same team, for any member', function () {
    $board = Whiteboard::factory()->create(['title' => 'Discovery', 'seq' => 1]);
    whiteboardFacilitator($board);
    [$user] = whiteboardMember($board);
    $file = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);
    Storage::put($file->path, 'image bytes');
    [$note, $text] = stickyWithText('note', 'Kept in history');
    $version = WhiteboardVersion::factory()->create([
        'whiteboard_id' => $board->id,
        'scene' => [
            'elements' => [
                $note,
                $text,
                sceneElement(['id' => 'photo', 'type' => 'image', 'fileId' => $file->file_id, 'status' => 'saved', 'scale' => [1, 1], 'index' => 'a3']),
                sceneElement(['id' => 'lost', 'type' => 'image', 'fileId' => 'gone-file', 'status' => 'saved', 'scale' => [1, 1], 'index' => 'a4']),
            ],
            'fileIds' => [$file->file_id, 'gone-file'],
        ],
    ]);

    $response = $this->actingAs($user)
        ->postJson(route('whiteboards.versions.copy.store', [$board, $version]))
        ->assertCreated();

    $copy = Whiteboard::query()->whereKeyNot($board->id)->sole();
    $elements = $copy->elements()->orderBy('seq')->get();

    $response->assertExactJson(['url' => route('whiteboards.show', $copy, absolute: false)]);

    expect($copy->title)->toBe('Discovery (copy)')
        ->and($copy->team_id)->toBe($board->team_id)
        ->and($copy->facilitator->user_id)->toBe($user->id)
        ->and($copy->private_writing)->toBeFalse()
        ->and($elements)->toHaveCount(3)
        ->and($elements->pluck('element_id')->intersect(['note', 'note-text', 'photo'])->all())->toBe([])
        ->and($elements[1]->data['text'])->toBe('Kept in history')
        ->and($elements[1]->data['containerId'])->toBe($elements[0]->element_id)
        ->and($elements[2]->data['fileId'])->toBe($file->file_id)
        ->and(Storage::get("whiteboards/{$copy->id}/{$file->file_id}"))->toBe('image bytes')
        ->and($copy->seq)->toBe(3)
        ->and($copy->last_versioned_seq)->toBe(3)
        ->and($board->fresh()->seq)->toBe(1)
        ->and($board->elements()->count())->toBe(0);

    Event::assertNotDispatched(WhiteboardElementsChanged::class);
    Event::assertNotDispatched(WhiteboardChanged::class);
});

it('refuses to copy a version for guests, outsiders and while the notes are hidden', function () {
    $table = privateWritingBoard();
    $board = $table['board'];
    [$note, $text] = stickyWithText('note', $table['secret']);
    $version = WhiteboardVersion::factory()->create([
        'whiteboard_id' => $board->id,
        'scene' => ['elements' => [$note, $text], 'fileIds' => []],
    ]);
    $copyUrl = route('whiteboards.versions.copy.store', [$board, $version]);

    whiteboardViewer($this, $table['guest'])->postJson($copyUrl)
        ->assertForbidden()
        ->assertJsonPath('message', 'Guests cannot do this.');

    $outsider = User::factory()->create();
    $board->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)->postJson($copyUrl)->assertForbidden();

    $hidden = $this->actingAs($table['other'])->postJson($copyUrl)
        ->assertStatus(422)
        ->assertJsonPath('message', 'Reveal the notes first.');

    expect(Whiteboard::query()->count())->toBe(1)
        ->and(whiteboardPayloadExposes($hidden->getContent(), $table['secret']))->toBeFalse();
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards/WhiteboardVersionRestoreTest.php`
Expected: FAIL — `Route [whiteboards.versions.restore.store] not defined`.

- [ ] **Step 3: Restore**

`app/Actions/Whiteboards/RestoreWhiteboardVersion.php`:

```php
<?php

namespace App\Actions\Whiteboards;

use App\Events\Whiteboards\WhiteboardChanged;
use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardVersion;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RestoreWhiteboardVersion
{
    private const IdLength = 20;

    private const MaxNonce = 2147483647;

    public function __construct(
        private StoreWhiteboardVersion $storeWhiteboardVersion,
        private SanitizeWhiteboardElement $sanitizeWhiteboardElement,
        private ScheduleWhiteboardVersion $scheduleWhiteboardVersion,
        private KeepWhiteboardTextOutOfLogs $keepWhiteboardTextOutOfLogs,
    ) {}

    public function handle(Whiteboard $board, WhiteboardMember $member, WhiteboardVersion $version): void
    {
        $this->keepWhiteboardTextOutOfLogs->handle($board->id, fn () => DB::transaction(function () use ($board, $member, $version): void {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            WhiteboardGuard::facilitator($locked, $member);
            WhiteboardGuard::notPrivateWriting($locked);

            $chosen = $locked->versions()->whereKey($version->id)->firstOrFail();

            $this->storeWhiteboardVersion->handle($locked, $member, $this->safetyName());

            $fromSeq = $locked->seq;
            $seq = $this->rewrite($locked, $member, $chosen, $fromSeq);

            if ($seq !== $fromSeq) {
                $locked->update(['seq' => $seq]);

                (new WhiteboardElementsChanged($locked->id, $seq, $fromSeq, null))->sendToOthers();

                $this->scheduleWhiteboardVersion->handle($locked, $fromSeq);
            }

            (new WhiteboardChanged($locked->id))->sendToOthers();
        }));
    }

    private function safetyName(): string
    {
        return __('Before restore · :date', ['date' => now()->locale(app()->getLocale())->isoFormat('LL LT')]);
    }

    /**
     * Writes the elements of the version over the board and tombstones the
     * rest. Returns the last seq given.
     */
    private function rewrite(Whiteboard $locked, WhiteboardMember $member, WhiteboardVersion $chosen, int $seq): int
    {
        $rows = $locked->elements()->get()->keyBy('element_id');
        $elements = $this->restorable($locked, $chosen);
        $freshIds = $this->freshIds($elements, $rows);
        $updated = (int) now()->getTimestampMs();
        $restored = [];

        foreach ($elements as $element) {
            $renamed = $this->renamed($element, $freshIds);
            $existing = isset($freshIds[$element['id']]) ? null : $rows->get($element['id']);
            $restored[$renamed['id']] = true;

            if ($existing !== null && ($this->cannotBeRewritten($existing) || $this->isUnchanged($existing, $renamed))) {
                continue;
            }

            $seq++;

            $this->write($locked, $member, $existing, [
                ...$renamed,
                'version' => $this->nextVersion($existing, $renamed),
                'versionNonce' => random_int(1, self::MaxNonce),
                'updated' => $updated,
            ], $seq);
        }

        foreach ($rows as $row) {
            if ($row->is_deleted || isset($restored[$row->element_id]) || $this->cannotBeRewritten($row)) {
                continue;
            }

            $seq++;

            $this->write($locked, $member, $row, [
                ...$row->data,
                'isDeleted' => true,
                'version' => $row->version + 1,
                'versionNonce' => random_int(1, self::MaxNonce),
                'updated' => $updated,
            ], $seq);
        }

        return $seq;
    }

    /**
     * What the board would accept today: an image whose file is no longer
     * stored is left out, as the copy path does.
     *
     * @return list<array<string, mixed>>
     */
    private function restorable(Whiteboard $locked, WhiteboardVersion $chosen): array
    {
        $fileIds = $locked->files()->pluck('file_id')->flip();
        $elements = [];

        foreach ($chosen->scene['elements'] as $raw) {
            $element = $this->sanitizeWhiteboardElement->handle($raw);

            if ($element === null || $element['isDeleted']) {
                continue;
            }

            if ($element['type'] === 'image' && ! $fileIds->has($element['fileId'])) {
                continue;
            }

            $elements[] = $element;
        }

        return $elements;
    }

    /**
     * An element whose row is gone (its tombstone was purged) or is a
     * tombstone no version can outrank comes back under a new id: a browser
     * left open may still hold the old tombstone at a higher version and
     * would delete the element again under its old id.
     *
     * @param  list<array<string, mixed>>  $elements
     * @param  Collection<string, WhiteboardElement>  $rows
     * @return array<string, string>
     */
    private function freshIds(array $elements, Collection $rows): array
    {
        $ids = [];

        foreach ($elements as $element) {
            $row = $rows->get($element['id']);

            if ($row === null || ($row->is_deleted && $this->cannotBeRewritten($row))) {
                $ids[$element['id']] = Str::random(self::IdLength);
            }
        }

        return $ids;
    }

    /**
     * @param  array<string, mixed>  $element
     * @param  array<string, string>  $ids
     * @return array<string, mixed>
     */
    private function renamed(array $element, array $ids): array
    {
        $element['id'] = $ids[$element['id']] ?? $element['id'];

        foreach (['frameId', 'containerId'] as $key) {
            if (is_string($element[$key] ?? null)) {
                $element[$key] = $ids[$element[$key]] ?? $element[$key];
            }
        }

        foreach (['startBinding', 'endBinding'] as $key) {
            if (is_array($element[$key] ?? null)) {
                $element[$key]['elementId'] = $ids[$element[$key]['elementId']] ?? $element[$key]['elementId'];
            }
        }

        if (is_array($element['boundElements'] ?? null)) {
            $element['boundElements'] = array_map(
                fn (array $bound): array => [...$bound, 'id' => $ids[$bound['id']] ?? $bound['id']],
                $element['boundElements'],
            );
        }

        return $element;
    }

    private function cannotBeRewritten(WhiteboardElement $row): bool
    {
        return $row->version >= SanitizeWhiteboardElement::MaxVersion;
    }

    /**
     * @param  array<string, mixed>  $element
     */
    private function isUnchanged(WhiteboardElement $existing, array $element): bool
    {
        return ! $existing->is_deleted
            && $existing->version === $element['version']
            && $existing->version_nonce === $element['versionNonce']
            && $existing->data == $element;
    }

    /**
     * @param  array<string, mixed>  $element
     */
    private function nextVersion(?WhiteboardElement $existing, array $element): int
    {
        if ($existing === null) {
            return 1;
        }

        return min(SanitizeWhiteboardElement::MaxVersion, max($existing->version, $element['version']) + 1);
    }

    /**
     * @param  array<string, mixed>  $element
     */
    private function write(Whiteboard $locked, WhiteboardMember $member, ?WhiteboardElement $existing, array $element, int $seq): void
    {
        $attributes = [
            'type' => $element['type'],
            'data' => $element,
            'version' => $element['version'],
            'version_nonce' => $element['versionNonce'],
            'is_sticky' => isset($element['customData']),
            'is_private' => false,
            'is_deleted' => $element['isDeleted'],
            'seq' => $seq,
        ];

        if ($existing !== null) {
            $existing->update($attributes);

            return;
        }

        $locked->elements()->create([
            ...$attributes,
            'element_id' => $element['id'],
            'author_member_id' => $member->id,
        ]);
    }
}
```

Why each piece is right, against the code it relies on:
- `nextVersion`: `$existing` reaches it only when its version is below `MaxVersion` (`cannotBeRewritten` was checked first), so the result is always above the stored version and never above the column's range.
- `isUnchanged` compares the whole element with `==`: the same stamp with a rewritten reference (`label` in the first test) is a change.
- The reference keys are those `RemapWhiteboardScene` rewrites; here a reference to an element that was not given a fresh id is kept as it is, including one that points outside the version (it pointed there when the version was stored).
- `write` mirrors `WriteWhiteboardElements::save()`; an element recreated under a fresh id has the restoring facilitator as author, because the version stores no authors.
- `KeepWhiteboardTextOutOfLogs` wraps the transaction because the "Before restore" insert and every element update carry text.

`app/Http/Controllers/Whiteboards/WhiteboardVersionRestoresController.php`:

```php
<?php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\RestoreWhiteboardVersion;
use App\Actions\Whiteboards\WhiteboardGuard;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardVersion;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class WhiteboardVersionRestoresController extends Controller
{
    public function store(Request $request, Whiteboard $board, WhiteboardVersion $version, RestoreWhiteboardVersion $restoreWhiteboardVersion): Response
    {
        $member = WhiteboardMember::current($request);

        WhiteboardGuard::notGuest($member);
        WhiteboardGuard::facilitator($board, $member);

        $restoreWhiteboardVersion->handle($board, $member, $version);

        return response()->noContent();
    }
}
```

- [ ] **Step 4: Copy to a new board**

In `app/Actions/Whiteboards/DuplicateWhiteboard.php` change `private function title(string $title): string` to `public function title(string $title): string` (the copy of a version is titled like the copy of a board).

`app/Actions/Whiteboards/CopyWhiteboardVersion.php`:

```php
<?php

namespace App\Actions\Whiteboards;

use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardFile;
use App\Models\WhiteboardVersion;
use Illuminate\Support\Facades\DB;

/**
 * @phpstan-import-type SceneFile from CopyWhiteboardScene
 */
class CopyWhiteboardVersion
{
    public function __construct(
        private CreateWhiteboard $createWhiteboard,
        private DuplicateWhiteboard $duplicateWhiteboard,
    ) {}

    /**
     * The same copy path as a template or a duplicate: fresh ids, version 1,
     * the board's images copied; an image the board lost is left out.
     */
    public function handle(Whiteboard $board, User $user, WhiteboardVersion $version): Whiteboard
    {
        return DB::transaction(function () use ($board, $user, $version): Whiteboard {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            WhiteboardGuard::notPrivateWriting($locked);

            $chosen = $locked->versions()->whereKey($version->id)->firstOrFail();

            return $this->createWhiteboard->handle($locked->team, $user, $this->duplicateWhiteboard->title($locked->title), [
                'elements' => $chosen->scene['elements'],
                'files' => $this->files($locked, $chosen),
            ]);
        });
    }

    /**
     * @return list<SceneFile>
     */
    private function files(Whiteboard $locked, WhiteboardVersion $chosen): array
    {
        return array_values($locked->files()
            ->whereIn('file_id', $chosen->scene['fileIds'])
            ->orderBy('file_id')
            ->get()
            ->map(fn (WhiteboardFile $file): array => [
                'fileId' => $file->file_id,
                'path' => $file->path,
                'mimeType' => $file->mime_type,
                'size' => $file->size,
            ])
            ->all());
    }
}
```

`app/Http/Controllers/Whiteboards/WhiteboardVersionCopiesController.php`:

```php
<?php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\CopyWhiteboardVersion;
use App\Actions\Whiteboards\WhiteboardGuard;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardVersion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WhiteboardVersionCopiesController extends Controller
{
    public function store(Request $request, Whiteboard $board, WhiteboardVersion $version, CopyWhiteboardVersion $copyWhiteboardVersion): JsonResponse
    {
        WhiteboardGuard::notGuest(WhiteboardMember::current($request));

        $copy = $copyWhiteboardVersion->handle($board, $request->user(), $version);

        return response()->json(['url' => route('whiteboards.show', $copy, absolute: false)], 201);
    }
}
```

- [ ] **Step 5: Routes and translations**

In `routes/web.php` import both controllers and add after the `versions/{version}` routes:

```php
        Route::post('versions/{version}/restore', [WhiteboardVersionRestoresController::class, 'store'])->name('whiteboards.versions.restore.store')->whereUuid('version');
        Route::post('versions/{version}/copy', [WhiteboardVersionCopiesController::class, 'store'])->name('whiteboards.versions.copy.store')->whereUuid('version');
```

| Key (English) | French | German | Spanish |
|---|---|---|---|
| Before restore · :date | Avant restauration · :date | Vor der Wiederherstellung · :date | Antes de restaurar · :date |
| :title (copy) | exists (plan 17b) | exists | exists |
| Only the facilitator can do this. | exists | exists | exists |

- [ ] **Step 6: 17c step — a restore ends the vote**

Spec §9: "An open voting session is closed without results (`results = []`); a closed, undismissed session is dismissed." Needs plan 17c's `whiteboard_vote_sessions` table; use its model when it exists (the query builder below only states the rule).

Add to `tests/Feature/Whiteboards/WhiteboardVersionRestoreTest.php` (imports `Illuminate\Support\Facades\DB`, `Illuminate\Support\Str`):

```php
it('closes an open vote without results and dismisses a closed one when a version is restored', function () {
    [$board, $facilitator, $version] = boardWithHistory();
    $open = (string) Str::uuid();
    $closed = (string) Str::uuid();
    $results = json_encode([['elementId' => 'same', 'text' => 'Counted', 'count' => 2]]);

    DB::table('whiteboard_vote_sessions')->insert([
        'id' => $closed, 'whiteboard_id' => $board->id, 'votes_per_member' => 3, 'allow_multiple' => false,
        'closed_at' => now()->subHour(), 'dismissed_at' => null, 'results' => $results,
        'created_at' => now()->subHours(2), 'updated_at' => now()->subHour(),
    ]);
    DB::table('whiteboard_vote_sessions')->insert([
        'id' => $open, 'whiteboard_id' => $board->id, 'votes_per_member' => 3, 'allow_multiple' => false,
        'closed_at' => null, 'dismissed_at' => null, 'results' => null,
        'created_at' => now(), 'updated_at' => now(),
    ]);

    restoreVersion($this->actingAs($facilitator), $board, $version)->assertNoContent();

    $sessions = DB::table('whiteboard_vote_sessions')->where('whiteboard_id', $board->id)->get()->keyBy('id');

    expect($sessions[$open]->closed_at)->not->toBeNull()
        ->and(json_decode($sessions[$open]->results, true))->toBe([])
        ->and($sessions[$open]->dismissed_at)->not->toBeNull()
        ->and($sessions[$closed]->dismissed_at)->not->toBeNull()
        ->and(json_decode($sessions[$closed]->results, true))->toBe(json_decode($results, true));
});
```

In `RestoreWhiteboardVersion::handle()`, right after the `$seq = $this->rewrite(...)` line, call `$this->endVoting($locked);`:

```php
    /**
     * The notes a vote counted may be gone or changed (spec §9): an open
     * session ends without results, and no closed session keeps its badges.
     */
    private function endVoting(Whiteboard $locked): void
    {
        DB::table('whiteboard_vote_sessions')
            ->where('whiteboard_id', $locked->id)
            ->whereNull('closed_at')
            ->update(['closed_at' => now(), 'results' => json_encode([]), 'updated_at' => now()]);

        DB::table('whiteboard_vote_sessions')
            ->where('whiteboard_id', $locked->id)
            ->whereNull('dismissed_at')
            ->update(['dismissed_at' => now(), 'updated_at' => now()]);
    }
```

The session closed by the first statement is dismissed by the second: it has no results to show. `board.changed`, already sent at the end of the restore, makes every client refetch the snapshot and drop its voting UI.

- [ ] **Step 7: Run, gates, commit**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards tests/Feature/TranslationKeysTest.php`
Expected: PASS.

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/phpstan analyse --memory-limit=1G app/Actions/Whiteboards/RestoreWhiteboardVersion.php app/Actions/Whiteboards/CopyWhiteboardVersion.php app/Actions/Whiteboards/DuplicateWhiteboard.php app/Http/Controllers/Whiteboards/WhiteboardVersionRestoresController.php app/Http/Controllers/Whiteboards/WhiteboardVersionCopiesController.php
git add app/Actions/Whiteboards/RestoreWhiteboardVersion.php app/Actions/Whiteboards/CopyWhiteboardVersion.php app/Actions/Whiteboards/DuplicateWhiteboard.php app/Http/Controllers/Whiteboards/WhiteboardVersionRestoresController.php app/Http/Controllers/Whiteboards/WhiteboardVersionCopiesController.php routes/web.php lang/en.json lang/fr.json lang/de.json lang/es.json tests/Feature/Whiteboards/WhiteboardVersionRestoreTest.php
git commit -m "feat(whiteboard): restore a version and copy one to a new board"
```

---

### Task 7: Board UI — private writing

Proposal, not run. Names checked: `ExcalidrawImperativeAPI.onChange(callback): UnsubscribeCallback`, `.onScrollChange(callback: (scrollX, scrollY, zoom) => void): UnsubscribeCallback`, `.getSceneElements()`, `.getAppState()` (`node_modules/@excalidraw/excalidraw/dist/types/excalidraw/types.d.ts`, lines 611–634); `AppState.scrollX`, `scrollY`, `zoom: Zoom` (`{value}`), same file lines 245–252; the screen position of a scene point is `(sceneX + scrollX) * zoom.value + offsetLeft` (`sceneCoordsToViewportCoords`, `dist/dev/chunk-4FTI6OG3.js` lines 1329–1339) — without `offsetLeft`/`offsetTop` it is relative to the canvas container; the canvas root `.excalidraw` is `position: relative; overflow: hidden` without a `z-index` (`dist/dev/index.css` lines 5579–5589), its canvases have `z-index` 1 and 2 and its UI layer 4 (`--zIndex-canvas`, `--zIndex-interactiveCanvas`, `--zIndex-layerUI`, same file), so a sibling with `z-index: 3` in the same container is drawn above the drawing and below every canvas control.

**Files:**
- Create: `resources/js/components/whiteboard/private-writing-banner.tsx`, `resources/js/components/whiteboard/masked-notes.tsx`
- Modify: `resources/js/lib/whiteboard/types.ts`, `resources/js/lib/whiteboard/excalidraw.ts`, `resources/js/components/whiteboard/board.tsx`, `resources/js/components/whiteboard/board-menu.tsx`, `lang/{en,fr,de,es}.json`

**Interfaces:**
- Consumes: snapshot `board.privateWriting` (Task 1); rejection reason `private` and the masked wire shape (Task 2); `PATCH settings {private_writing}` (Task 3) through Wayfinder `WhiteboardSettingsController.update(boardId)`; `retroRequest`, `RetroRequestError` (`resources/js/lib/retro/api.ts`); `WhiteboardState` (`resources/js/hooks/use-whiteboard.ts`); `SceneSync.resync()` (`resources/js/lib/whiteboard/scene-sync.ts`).
- Produces: `WhiteboardSnapshot['board']['privateWriting']: boolean`; `RejectReason` includes `'private'`; `<PrivateWritingBanner state={state} />`; `<MaskedNotes api={api} />`. Task 8 reads `board.privateWriting` to disable the history button.

No change to `scene-sync.ts` or `restore.ts`: see "Wire shape of a private note" at the top of this plan for why a masked note is neither deleted on the server nor written back.

- [ ] **Step 1: Types** — in `resources/js/lib/whiteboard/types.ts` add `privateWriting: boolean;` to `WhiteboardSnapshot['board']` and `'private'` to `RejectReason`. In `resources/js/lib/whiteboard/excalidraw.ts` add `'getSceneElements' | 'onChange' | 'onScrollChange'` to the `RequiredApi` pick (the list of API members skrum relies on, checked at build time).

- [ ] **Step 2: Rejection message and resync on the switch** — in `board.tsx`:

  - add `private: ''` to the initial `rejectionMessages` record and `private: t('Only its author can change a hidden note.')` to the assignment below it (shown as a toast when the canvas let the viewer drag, edit or erase a masked note; the canvas then returns to the server copy by the existing `settle` path);
  - after the polling effect:

```tsx
    const privateWriting = state.snapshot.board.privateWriting;

    // The reveal reaches the other clients as an `elements.changed` without
    // elements; the tab that asked for it, and a tab that missed the event,
    // learn it from the snapshot and fetch the notes here.
    useEffect(() => {
        void sync.current?.resync();
    }, [privateWriting]);
```

- [ ] **Step 3: The switch** — in `board-menu.tsx`, in the facilitator block, after the "Show flying reactions" item:

```tsx
<DropdownMenuCheckboxItem
    checked={board.privateWriting}
    onCheckedChange={(checked) => updateSettings({ private_writing: checked })}
>
    {t('Private writing')}
</DropdownMenuCheckboxItem>
```

`updateSettings` already toasts the server's message on failure ("Close the vote first.") and refetches the snapshot on success. If plan 17c built a facilitator bar (spec §13: timer, vote, private writing, lock, follow), put the switch there instead, with the same call, and keep one switch only. In the same file, the "Duplicate this board" and "Save as template" items of plan 17b get `disabled={board.privateWriting}` (the server answers 422 "Reveal the notes first." anyway).

- [ ] **Step 4: The banner** — `private-writing-banner.tsx`, rendered in `board.tsx` right after `<ConnectionBanner … />`:

```tsx
export function PrivateWritingBanner({ state }: { state: WhiteboardState }) {
    const { t } = useTrans();
    const { board, me } = state.snapshot;

    if (!board.privateWriting) {
        return null;
    }

    const reveal = async () => {
        try {
            await retroRequest(WhiteboardSettingsController.update(board.id), { private_writing: false });
            await state.refetch();
        } catch (error) {
            toast.error(
                error instanceof RetroRequestError && error.status > 0
                    ? error.message
                    : t('Something went wrong. Please try again.'),
            );
        }
    };

    return (
        <div
            role="status"
            className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-violet-100 px-4 py-1 text-center text-sm text-violet-900 dark:bg-violet-950 dark:text-violet-100"
        >
            <span>{t('Notes are hidden until the facilitator reveals them. Other elements stay visible.')}</span>
            <span className="text-xs opacity-80">{t('The size of a note hints at the length of its text.')}</span>
            {me.isFacilitator && (
                <Button size="sm" variant="outline" onClick={reveal}>
                    {t('Reveal the notes')}
                </Button>
            )}
        </div>
    );
}
```

The banner is a row of the page's flex column, above the canvas: it covers nothing.

- [ ] **Step 5: The marks** — `masked-notes.tsx`. Give the canvas container `relative` (`className="whiteboard-canvas relative min-h-0 flex-1"`; do not add `isolate`: the canvas's own layers must keep stacking against the page) and render `{api && privateWriting && <MaskedNotes api={api} />}` inside it, after `<Excalidraw>…</Excalidraw>` (`privateWriting` is the constant of Step 2; masked notes only exist while the switch is on, so the overlay costs nothing the rest of the time).

```tsx
type Mark = { id: string; left: number; top: number; width: number; height: number; angle: number; size: number };

type Shape = SceneElement & {
    x: number;
    y: number;
    width: number;
    height: number;
    angle?: number;
    customData?: { skrum?: { masked?: boolean } };
    boundElements?: { id: string; type: string }[] | null;
};

function marksOf(api: ExcalidrawImperativeAPI): Mark[] {
    const { scrollX, scrollY, zoom } = api.getAppState();
    const elements = api.getSceneElements() as unknown as Shape[];
    const live = new Set(elements.map((element) => element.id));

    return elements
        .filter(
            (element) =>
                element.customData?.skrum?.masked === true &&
                !(element.boundElements ?? []).some((bound) => bound.type === 'text' && live.has(bound.id)),
        )
        .map((element) => ({
            id: element.id,
            left: (element.x + scrollX) * zoom.value,
            top: (element.y + scrollY) * zoom.value,
            width: element.width * zoom.value,
            height: element.height * zoom.value,
            angle: element.angle ?? 0,
            size: Math.max(12, 28 * zoom.value),
        }));
}

export function MaskedNotes({ api }: { api: ExcalidrawImperativeAPI }) {
    const { t } = useTrans();
    const [marks, setMarks] = useState<Mark[]>([]);

    useEffect(() => {
        const update = () => {
            const next = marksOf(api);

            setMarks((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
        };

        update();

        const offChange = api.onChange(update);
        const offScroll = api.onScrollChange(update);

        return () => {
            offChange();
            offScroll();
        };
    }, [api]);

    return (
        <div className="pointer-events-none absolute inset-0 z-[3] overflow-hidden">
            {marks.map((mark) => (
                <span
                    key={mark.id}
                    role="img"
                    aria-label={t('Hidden note')}
                    className="absolute flex items-center justify-center text-foreground/60 select-none"
                    style={{
                        left: mark.left,
                        top: mark.top,
                        width: mark.width,
                        height: mark.height,
                        fontSize: mark.size,
                        transform: `rotate(${mark.angle}rad)`,
                    }}
                >
                    •••
                </span>
            ))}
        </div>
    );
}
```

`getSceneElements()` returns the non-deleted elements: a masked note's bound text is deleted locally, so the note has no live text and gets its mark; once revealed, the server copy has no `masked` marker and the mark goes. The comparison keeps the frequent `onChange` calls (every pointer move) from re-rendering when nothing moved. Known limit, accepted: a member who duplicates a masked note gets an empty note of their own that shows the mark until they type in it (the marker is copied by the canvas and dropped by the server on write).

- [ ] **Step 6: Translations**

| Key (English) | French | German | Spanish |
|---|---|---|---|
| Private writing | Écriture privée | Privates Schreiben | Escritura privada |
| Notes are hidden until the facilitator reveals them. Other elements stay visible. | Les post-it sont masqués jusqu'à ce que l'animateur les révèle. Les autres éléments restent visibles. | Haftnotizen bleiben verborgen, bis der Moderator sie aufdeckt. Andere Elemente bleiben sichtbar. | Las notas adhesivas quedan ocultas hasta que el facilitador las revele. Los demás elementos siguen visibles. |
| The size of a note hints at the length of its text. | La taille d'un post-it laisse deviner la longueur de son texte. | Die Größe einer Haftnotiz lässt die Länge ihres Textes erahnen. | El tamaño de una nota adhesiva deja intuir la longitud de su texto. |
| Reveal the notes | Révéler les post-it | Haftnotizen aufdecken | Revelar las notas adhesivas |
| Hidden note | Post-it masqué | Verborgene Haftnotiz | Nota adhesiva oculta |
| Only its author can change a hidden note. | Seul son auteur peut modifier un post-it masqué. | Nur der Autor kann eine verborgene Haftnotiz ändern. | Solo su autor puede modificar una nota adhesiva oculta. |
| Something went wrong. Please try again. | exists | exists | exists |

- [ ] **Step 7: Gates and commit**

Run: `npm run build && npm run types:check && npx vp check resources/js/lib/whiteboard/types.ts resources/js/lib/whiteboard/excalidraw.ts resources/js/components/whiteboard/board.tsx resources/js/components/whiteboard/board-menu.tsx resources/js/components/whiteboard/private-writing-banner.tsx resources/js/components/whiteboard/masked-notes.tsx && DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: no error in these files; test PASS.

```bash
git add resources/js/lib/whiteboard/types.ts resources/js/lib/whiteboard/excalidraw.ts resources/js/components/whiteboard/board.tsx resources/js/components/whiteboard/board-menu.tsx resources/js/components/whiteboard/private-writing-banner.tsx resources/js/components/whiteboard/masked-notes.tsx lang/en.json lang/fr.json lang/de.json lang/es.json
git commit -m "feat(whiteboard): private writing switch, banner and masked note marks on the board"
```

**Browser checks (for the walkthrough):**
- B7.1 Facilitator A: the board menu has "Private writing"; a member and a guest do not see it. Switching it on shows the violet banner with the spec's sentence in every browser without a reload; only A's banner has "Reveal the notes".
- B7.2 Member B (127.0.0.1) adds a sticky note and types "Secret idea": B sees the text; A and a guest see an empty note of the same colour at the same place with "•••" centred on it. In A's browser, `fetch` of `GET snapshot` and `GET elements?since=0` (XSRF header) returns no "Secret idea".
- B7.3 A pans and zooms: every "•••" stays on its note; a note scrolled under the shapes toolbar, the zoom controls or the reactions bar has its mark behind them, never over them; the marks never block a click on the canvas.
- B7.4 A drags B's masked note, erases it, and double-clicks it to type: each time the canvas returns to the masked note within about a second, a toast says "Only its author can change a hidden note.", and B's browser still shows "Secret idea" in place.
- B7.5 A note that existed before the switch keeps its text for everyone; typing into it while the switch is on shows for everyone. A plain text and a rectangle with a label added while the switch is on are visible to everyone.
- B7.6 B opens the board in a second tab: the note shows its text there too.
- B7.7 A clicks "Reveal the notes": within about a second every browser, A's included, shows "Secret idea" without a reload, the marks and the banner disappear. B deleted a second hidden note before the reveal: it does not appear.
- B7.8 While the switch is on: "Duplicate this board" and "Save as template" are disabled; calling `POST duplicate` from the console answers 422 "Reveal the notes first.". Exporting as PNG from A's browser shows B's note empty.
- B7.9 **17c:** with a vote open the switch answers the toast "Close the vote first."; with the switch on, opening a vote is refused with "Reveal the notes first.".

---

### Task 8: Board UI — the history panel

Proposal, not run. Names checked: props `viewModeEnabled?: boolean` and `initialData` with `scrollToContent?: boolean` (`dist/types/excalidraw/types.d.ts` lines 407 and 436, `dist/types/excalidraw/data/types.d.ts` line 32); `UIOptions.canvasActions` keys `changeViewBackgroundColor`, `clearCanvas`, `export`, `loadScene`, `saveToActiveFile`, `toggleTheme`, `saveAsImage` (`types.d.ts` lines 475–483); `MainMenu.DefaultItems.SaveAsImage` (`dist/types/excalidraw/components/main-menu/DefaultItems.d.ts`); `ExcalidrawImperativeAPI.addFiles(data: BinaryFileData[])` (`types.d.ts` line 619). Without a `<MainMenu>` child the canvas renders its default menu, which ends with links to the library's sites: the preview must pass its own.

**Files:**
- Create: `resources/js/components/whiteboard/history-panel.tsx`, `resources/js/components/whiteboard/version-preview.tsx`
- Modify: `resources/js/lib/whiteboard/types.ts`, `resources/js/components/whiteboard/top-bar.tsx`, `resources/js/components/whiteboard/board.tsx`, `lang/{en,fr,de,es}.json`

**Interfaces:**
- Consumes: Wayfinder actions generated by `npm run build` from Tasks 5–6: `WhiteboardVersionsController.index(boardId)`, `.store(boardId)`, `.show({ board, version })`, `.update({ board, version })`, `.destroy({ board, version })`, `WhiteboardVersionRestoresController.store({ board, version })`, `WhiteboardVersionCopiesController.store({ board, version })`; `retroRequest`, `RetroRequestError`; `restoreScene` (`resources/js/lib/whiteboard/restore.ts`); `downloadBoardFile(boardId, fileId)` (`resources/js/lib/whiteboard/files.ts`); `Sheet`, `SheetContent`, `SheetTitle` (`resources/js/components/ui/sheet.tsx`), `Dialog` parts, `DropdownMenu` parts; `board.privateWriting`, `me.isGuest`, `me.isFacilitator`.
- Produces: nothing for later tasks.

- [ ] **Step 1: Types** — in `types.ts`:

```ts
export type WhiteboardVersionSummary = {
    id: string;
    name: string | null;
    createdAt: string;
    createdByName: string | null;
    automatic: boolean;
};

export type WhiteboardVersionScene = {
    elements: SceneElement[];
    files: { id: string; url: string; mimeType: string }[];
};
```

- [ ] **Step 2: The button** — `top-bar.tsx` takes a new prop `onOpenHistory: () => void` and renders, between `<PresenceStrip … />` and `{children}`, for `!state.snapshot.me.isGuest` only:

```tsx
<Button
    size="icon"
    variant="outline"
    aria-label={t('Version history')}
    title={board.privateWriting ? t('Reveal the notes first.') : t('Version history')}
    disabled={board.privateWriting}
    onClick={onOpenHistory}
>
    <History className="size-4" />
</Button>
```

(`History` from `lucide-react`.) In `board.tsx`: `const [historyOpen, setHistoryOpen] = useState(false)`, `<TopBar state={state} onOpenHistory={() => setHistoryOpen(true)}>`, and next to `<BoardReactions … />`:

```tsx
<HistoryPanel
    state={state}
    open={historyOpen}
    onOpenChange={setHistoryOpen}
    onRestored={() => {
        void sync.current?.resync();
        void state.refetch();
    }}
/>
```

The restore is broadcast to the others; the tab that asked for it fetches the delta itself, as it does after any write.

- [ ] **Step 3: `HistoryPanel`** — `({ state, open, onOpenChange, onRestored }: { state: WhiteboardState; open: boolean; onOpenChange: (open: boolean) => void; onRestored: () => void })`. A `Sheet` on the right (`<SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-md">`), mounted content only while `open`:

  - Title `t('Version history')`.
  - A form: `Input` (`maxLength={80}`, `aria-label={t('Version name')}`, placeholder `t('Version name')`) and a button `t('Save this version')` (disabled while empty or saving). Submit: `retroRequest(WhiteboardVersionsController.store(board.id), { name })` → `toast.success(t('Version saved.'))`, clear the input, reload the list. A 422 shows `error.message` under the input (the cap, or validation) and keeps what was typed.
  - The list, loaded when the panel opens and after each action: `retroRequest<WhiteboardVersionSummary[]>(WhiteboardVersionsController.index(board.id))`. While loading: three `Skeleton` rows. Empty: `t('No version yet.')`. A failure shows `error.message` in place of the list (422 "Reveal the notes first." if private writing was switched on meanwhile) with a `t('Retry')` button.
  - Each row: the name, or `t('Automatic version')` when `automatic`; under it the date (`new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(createdAt))`, `locale` from `usePage().props` as in `board.tsx`) and, when `createdByName`, `t('by :name', { name: createdByName })`; a button `t('Preview')`; a `DropdownMenu` (trigger: `MoreHorizontal` icon, `aria-label={t('Version actions')}`) with `t('Copy to a new board')` for everyone and, for `me.isFacilitator`, `t('Restore')`, `t('Rename')`, `t('Delete')` (destructive).
  - Copy: `const { url } = await retroRequest<{ url: string }>(WhiteboardVersionCopiesController.store({ board: board.id, version: id }))` → `router.visit(url)`.
  - Restore: a confirmation `Dialog` — title `t('Restore this version?')`, text `t('The board goes back to this version for everyone. The current state is saved first.')`, buttons `t('Cancel')` / `t('Restore')`. On confirm: `retroRequest(WhiteboardVersionRestoresController.store({ board: board.id, version: id }))` → `toast.success(t('Version restored.'))`, `onRestored()`, reload the list (the "Before restore" version appears on top).
  - Rename: a `Dialog` with an `Input` prefilled with the name (empty for an automatic version), `maxLength={80}`, `t('Save')` → `PATCH` with `{ name }`; a 422 shows under the input.
  - Delete: a confirmation `Dialog` — title `t('Delete this version?')`, buttons `t('Cancel')` / `t('Delete')` → `DELETE`.
  - Every failed action: `toast.error(error instanceof RetroRequestError && error.status > 0 ? error.message : t('Something went wrong. Please try again.'))`, panel and dialog left as they were (spec §13).

  The panel is a sheet above the page with its own overlay: it does not sit on the canvas while the user draws.

- [ ] **Step 4: `VersionPreview`** — `({ boardId, version, onClose }: { boardId: string; version: WhiteboardVersionSummary | null; onClose: () => void })`. A `Dialog` open while `version !== null`, `<DialogContent className="flex h-[85vh] max-w-6xl flex-col" aria-describedby={undefined}>`, title = the version's name or `t('Automatic version')`, followed by its date. It fetches `retroRequest<WhiteboardVersionScene>(WhiteboardVersionsController.show({ board: boardId, version: version.id }))`, shows a `Skeleton` until it has the scene, then:

```tsx
<div className="min-h-0 flex-1">
    <Excalidraw
        excalidrawAPI={setPreviewApi}
        initialData={{ elements: restoreScene(scene.elements) as never, scrollToContent: true }}
        viewModeEnabled
        langCode={ExcalidrawLocales[locale as string] ?? 'en'}
        theme={dark ? 'dark' : 'light'}
        aiEnabled={false}
        UIOptions={{
            canvasActions: {
                loadScene: false,
                saveToActiveFile: false,
                toggleTheme: false,
                export: false,
                clearCanvas: false,
                changeViewBackgroundColor: false,
            },
        }}
    >
        <MainMenu>
            <MainMenu.DefaultItems.SaveAsImage />
        </MainMenu>
    </Excalidraw>
</div>
```

  No `onChange`, no scene sync, no cursors: nothing the viewer does in the preview is written anywhere. When `previewApi` and the scene are there, for each `scene.files` entry: `downloadBoardFile(boardId, file.id)` then `previewApi.addFiles([{ id: file.id, dataURL, mimeType, created: Date.now() } as never])` (the call `scene-sync.ts` makes for the board's own images); a failed download leaves the image's placeholder. Move `ExcalidrawLocales` and the `dark` hook of `board.tsx` to a small shared module of the same folder if importing them from `board.tsx` would create a cycle. The preview is mounted from `HistoryPanel` (state `previewed: WhiteboardVersionSummary | null`).

- [ ] **Step 5: Translations**

| Key (English) | French | German | Spanish |
|---|---|---|---|
| Version history | Historique des versions | Versionsverlauf | Historial de versiones |
| Version name | Nom de la version | Name der Version | Nombre de la versión |
| Save this version | Enregistrer cette version | Diese Version speichern | Guardar esta versión |
| Version saved. | Version enregistrée. | Version gespeichert. | Versión guardada. |
| No version yet. | Aucune version pour l'instant. | Noch keine Version. | Aún no hay versiones. |
| Automatic version | Version automatique | Automatische Version | Versión automática |
| Version actions | Actions sur la version | Aktionen für die Version | Acciones de la versión |
| Copy to a new board | Copier dans un nouveau tableau | In ein neues Board kopieren | Copiar a una pizarra nueva |
| Restore this version? | Restaurer cette version ? | Diese Version wiederherstellen? | ¿Restaurar esta versión? |
| The board goes back to this version for everyone. The current state is saved first. | Le tableau revient à cette version pour tout le monde. L'état actuel est d'abord enregistré. | Das Board kehrt für alle zu dieser Version zurück. Der aktuelle Stand wird vorher gespeichert. | La pizarra vuelve a esta versión para todos. Antes se guarda el estado actual. |
| Version restored. | Version restaurée. | Version wiederhergestellt. | Versión restaurada. |
| Delete this version? | Supprimer cette version ? | Diese Version löschen? | ¿Eliminar esta versión? |
| Preview, Restore, Rename, Delete, Cancel, Save, Retry, by :name, Reveal the notes first., Something went wrong. Please try again. | exist | exist | exist |

Run `grep -n '"<key>"' lang/fr.json` for each new row first: `tests/Feature/TranslationKeysTest.php` is the judge.

- [ ] **Step 6: Gates and commit**

Run: `npm run build && npm run types:check && npx vp check resources/js/lib/whiteboard/types.ts resources/js/components/whiteboard/top-bar.tsx resources/js/components/whiteboard/board.tsx resources/js/components/whiteboard/history-panel.tsx resources/js/components/whiteboard/version-preview.tsx && DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: no error in these files; test PASS.

```bash
git add resources/js/lib/whiteboard/types.ts resources/js/components/whiteboard/top-bar.tsx resources/js/components/whiteboard/board.tsx resources/js/components/whiteboard/history-panel.tsx resources/js/components/whiteboard/version-preview.tsx lang/en.json lang/fr.json lang/de.json lang/es.json
git commit -m "feat(whiteboard): history panel with preview, restore and copy to a new board"
```

(Add the shared module of Step 4 if one was created.)

**Browser checks (for the walkthrough):**
- B8.1 A member sees the history button in the top bar; a guest (127.0.0.1) does not. While private writing is on the button is disabled with the title "Reveal the notes first.".
- B8.2 The panel lists versions newest first; an automatic one reads "Automatic version" with its date, a named one its name, date and "by <name>".
- B8.3 "Save this version" with a name adds it on top with a success toast; an empty name cannot be submitted.
- B8.4 "Preview" opens a read-only canvas showing that version, images included, that can be panned and zoomed but not edited; its menu offers only "Save as image"; no library name, logo or link appears; closing it leaves the board untouched (no `PUT elements` in the network log while the preview was open).
- B8.5 Facilitator: "Restore" asks for confirmation, then every browser (member B and a guest too) shows the version's scene within about a second without a reload, and a "Before restore · <date>" version is on top of the list. Restoring that one brings the previous state back in every browser.
- B8.6 A non-facilitating member sees "Copy to a new board" only in the row menu; the facilitator also sees "Restore", "Rename", "Delete".
- B8.7 "Copy to a new board" lands on "<title> (copy)" with the version's elements and images, the member as facilitator; the source board is unchanged.
- B8.8 Rename and delete update the list; a failed action (stop the server, or rename with 81 characters through the console) leaves the panel and its dialog open with a message.
- B8.9 After five minutes of edits (or after running `vendor/bin/sail artisan queue:work --once` once the delayed job is due) an "Automatic version" appears when the panel is reopened.
- B8.10 **17c:** restoring while a vote is open ends the vote in every browser without results; badges of a closed vote disappear.

---

### Task 9: Acceptance and verification

**Files:**
- Create: `docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md`
- Modify: whatever the gates show to be wrong (with a test when a server rule was missing; spec first if the spec is wrong).

**Interfaces:**
- Consumes: everything above.
- Produces: the walkthrough file replayed by the automated Chrome walkthrough after this plan.

- [ ] **Step 1: Write the walkthrough file**

Title `# Plan 17d — whiteboard secrecy and history: walkthrough`, a "Before starting" paragraph (`vendor/bin/sail artisan migrate --no-interaction`, `npm run build`, a queue worker running for the automatic versions — `vendor/bin/sail artisan queue:work` — and the accounts and origins of `.superpowers/sdd/whiteboard-rules.md`: facilitator A on `http://localhost`, member B or a guest on `http://127.0.0.1`), then one section per acceptance criterion of spec §16, each with an unticked `- [ ]` line per check, written as **Setup → Action → Expected**:

Private writing (R9)

1. **Given private writing is on, when member A writes a sticky, then member B and the facilitator see a masked note at the same place and no payload they receive contains its text.** Setup: facilitator A and member B on the same board, private writing on. Action: B writes a note "Secret idea"; A fetches `GET snapshot` and `GET elements?since=0` from the console. Expected: A sees the note masked with "•••" at the same place, same size and colour; neither response contains "Secret idea"; B's second tab shows the text. Include B7.1, B7.2, B7.3, B7.5, B7.6.
2. **Given a masked note, when another member edits or deletes it, then the write is rejected and the author's text is intact.** Setup: as 1. Action: A drags, erases and types on B's note; A sends `PUT elements` from the console with the masked text at `version + 1` and `text: "Overwritten"`. Expected: each attempt returns to the masked note; the console call answers `rejected[0].reason = "private"` with an element whose `text` is empty; `select data->>'text' from whiteboard_elements where element_id = '<text id>'` still reads "Secret idea". Include B7.4.
3. **Given the facilitator reveals, then every member sees every note's text without reloading.** Setup: as 1, plus a second hidden note B deleted. Action: A clicks "Reveal the notes". Expected: every browser shows "Secret idea" within about a second; the deleted note does not come back; the banner and the marks are gone. Include B7.7.
4. **While private writing is on, voting, version history, duplicate and save-as-template answer 422 "Reveal the notes first."** Setup: private writing on. Action: from A's console, `POST duplicate`, `POST template`, `GET versions`, `GET versions/<id>`, `POST versions/<id>/restore`, `POST versions/<id>/copy`, and opening a vote. Expected: 422 with that message for each; the menu entries and the history button are disabled. Include B7.8, B7.9, B8.1.

Version history (R10)

5. **Given edits over more than 5 minutes, then automatic versions exist, at most one per 5 minutes, and never more than 50.** Setup: a board, the queue worker running. Action: edit, wait five minutes, edit again, wait five minutes; read `select name, seq, created_at from whiteboard_versions where whiteboard_id = '<id>' order by created_at`. Expected: one automatic version per five-minute window of activity, none while idle. The cap of 50 is pinned by `WhiteboardAutomaticVersionsTest` ("keeps the last fifty automatic versions and every named one") and not replayed by hand. Include B8.2, B8.9.
6. **Given a version, when the facilitator restores it, then every connected browser shows that scene and a "Before restore" version exists that restores the prior state.** Setup: A and B on a board with a saved version, then more edits. Action: A restores the version, then restores "Before restore · …". Expected: both browsers show the version, then the previous state, each time without a reload. Include B8.3, B8.4, B8.5, B8.6, B8.7, B8.8, B8.10.
7. **A guest gets 403 on every version endpoint.** Setup: guest on 127.0.0.1. Action: from the guest's console, the seven version requests (`GET versions`, `POST versions`, `GET`, `PATCH`, `DELETE versions/<id>`, `POST …/restore`, `POST …/copy`). Expected: 403 "Guests cannot do this." for each; no history button.

End with a "Feature tests that pin these criteria" list: `WhiteboardPrivateWritingTest`, `WhiteboardPrivateWritingSwitchTest`, `WhiteboardAutomaticVersionsTest`, `WhiteboardVersionsTest`, `WhiteboardVersionRestoreTest`, `WhiteboardSecrecyModelTest`, and a table "surface of the invariant → test" with these rows: snapshot, Inertia page and `GET elements` → "masks a private note for everyone but its author"; `rejected` copies → "refuses every change another member makes to a private note and keeps the text"; `elements.changed` → "never broadcasts the elements of a write that touches a private note" and "reveals every live private note and makes every client fetch it"; versions → "keeps the history closed while the notes are hidden" and "refuses to copy a version for guests, outsiders and while the notes are hidden"; duplicate and template → "refuses duplicate and save as template until the notes are revealed" and "copies the notes once they are revealed, and never one deleted while hidden"; export → client-side from the masked copies (B7.8); log lines → "keeps the text of a note out of the log, even when the database refuses the write" and "keeps the scene out of the log when a version cannot be stored".

- [ ] **Step 2: Full gates**

```bash
vendor/bin/pint --dirty --format agent
DB_HOST=127.0.0.1 php -d memory_limit=-1 vendor/bin/pest --compact
composer lint
npm run build && npm run types:check
npx vp check resources/js/lib/whiteboard resources/js/components/whiteboard resources/js/hooks/use-whiteboard.ts
vendor/bin/sail artisan migrate --no-interaction
```

Expected: the suite passes; PHPStan and Pint clean; `types:check` shows only the known `manage-passkeys.tsx` error; no `vp check` failure in the listed files. Confirm no dependency changed: `git diff <base of this plan> -- package.json composer.json` is empty.

- [ ] **Step 3: Check the invariant once more by reading**

Run `grep -rn "->data\b" app/Actions/Whiteboards app/Http/Controllers/Whiteboards app/Events/Whiteboards app/Jobs/StoreAutomaticWhiteboardVersion.php` and, for every hit outside `PresentWhiteboardElement`, state in the report where the value goes: a server-side copy guarded by `notPrivateWriting`, a version row, the restore, an index or lock comparison, or — the only broadcast — `WriteWhiteboardElements::broadcastable()` after its private check. A hit that reaches a response, a broadcast or a log without one of these is a defect: fix it with a test. Do the same for `Log::`, `logger(` and `report(` in the same folders (expected: none that receives an element, a scene or a version).

- [ ] **Step 4: Fix what the gates show**, re-run the affected gate, and record each fix in the report.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md
git commit -m "docs(whiteboard): walkthrough for private writing and version history"
```

(Add any fixed file by its explicit path to the same or a separate commit.)

**UI strings added by this task:** none.

---

## Spec edits made with this plan

Each is a decision the spec needed for this slice; none changes a behaviour the user decided. They are in the same commit as this plan.

1. **§7 `whiteboard_versions.scene`** is `{elements, fileIds}`: the ids of the images beside the elements, so that the image prune can ask "does a version show this file" without reading every scene.
2. **§9 automatic versions:** one at most every five minutes (a job that finds a younger automatic version does nothing); a board made from a template, a duplicate or a version starts with nothing left to version; the daily command queues the version of a board whose job was lost.
3. **§9 named versions:** naming an automatic version makes it a named one, within the cap; the facilitator may delete any version; saving returns the list item.
4. **§9 restore:** the "Before restore" version is not refused by the cap; an element unchanged since the version is left alone; an element whose row is gone, or is a tombstone at the highest version number, comes back under a fresh id with its references rewritten; a live element at the highest version number is left as it is; a session closed by the restore is dismissed too.
5. **§9 copy:** the copy is titled like a duplicate and answers 201.
6. **§9 private writing:** saving, renaming and deleting a version stay allowed while the notes are hidden (they return no scene); list, preview, restore and copy are refused.
7. **§11.5 on:** the refusal while a vote is open is 422 "Close the vote first.".
8. **§11.5 masking:** the masked copy keeps the stored version and nonce; the note carries the marker, its text is emptied; a private element without an author is masked for everyone.
9. **§11.5 write rules:** which rows become private (a new sticky note; a text bound to a private note; a new bound text whose container is not stored yet); a private note only takes text of its own author; privacy is never cleared by a write while private writing is on.
10. **§11.5 reveal:** clears the flag of live elements only and gives them a new `seq`; sends `elements.changed` without elements, then `board.changed`; a note deleted while hidden stays masked until purged.
11. **§11.5 invariant, log lines:** a database error on a statement that carries note text is reported without the statement or its bindings.
12. **§12:** the `PATCH settings` row lists `elements.changed`; the versions rows give the 201 bodies.
13. **§13:** a rejection for reason `locked` or `private` says why in a toast (the first is what plan 17a built).

## Assumptions to reconcile

Read this before Task 1. The plan was written at `e0524df`, without sight of plan 17c or of the end of plan 17b.

**Plan 17b, not finished when this was written**
- Task 8 (board UI: "Duplicate this board", "Save as template", export name) was in progress: `board-menu.tsx` and `board.tsx` had uncommitted changes and `save-template-dialog.tsx` was untracked. Task 7 Step 3 of this plan disables those two menu items while private writing is on: apply it to whatever Task 8 shipped.
- Task 9 (walkthrough) had not started.
- `DuplicateWhiteboard` and `SaveWhiteboardTemplate` are edited here as they were at `e0524df` (one line each after the board lock, and `DuplicateWhiteboard::title()` made public). If their shape changed, keep the rule: `WhiteboardGuard::notPrivateWriting($locked)` inside the board lock, before the scene is read.

**Plan 17c, written in parallel**
- *Tables and names taken from the spec, not from 17c's code:* table `whiteboard_vote_sessions` with `closed_at`, `dismissed_at`, `results`, `votes_per_member`, `allow_multiple`; route name `whiteboards.voteSessions.store`; body keys `votes_per_member`, `allow_multiple`. The three "17c steps" (Task 3 Step 8, Task 6 Step 6, browser checks B7.9 and B8.10) use the query builder so that they hold whatever the model is called; switch them to 17c's model, factory, guard (`WhiteboardGuard::openVoteSession` in the spec) and route names. If 17c is not on the branch when 17d is implemented, these steps cannot pass: implement them when it is.
- *Opening a vote while the notes are hidden* must answer 422 "Reveal the notes first." (`WhiteboardGuard::notPrivateWriting($locked)` inside 17c's lock). 17c may have left this to 17d or written it against a column that did not exist.
- *The message "Close the vote first."* is this plan's wording; reuse 17c's key if it has one with the same meaning.
- *`WriteWhiteboardElements`* is edited by both plans (17c: board lock, element lock by the facilitator, text freeze with reason `voting`; 17d: reason `private`, the flag, the ids-only rule, the wrapper, version scheduling). Order of refusals after reconciliation: `stale`, `private`, then 17c's and 17a's (`voting`, `locked`, `file`, `full`). The 403 of a locked board is 17c's and comes before any element is looked at.
- *`WhiteboardSettingsController::update`* is edited by both (17c: `locked`, `follow_enabled`; 17d: `private_writing`). Keep one validation array and one transaction; `private_writing` is pulled out of the mass update and applied through `SetWhiteboardPrivateWriting`.
- *`BuildWhiteboardSnapshot`, `types.ts`, `Whiteboard` (fillable, casts), `WhiteboardFactory`* gain keys from both plans: merge, do not replace.
- *Migration date:* `2026_10_12_100000` assumes 17c's migrations are dated `2026_10_11_*` or earlier. If 17c used a later date, rename this one after it; nothing in it depends on 17c's columns.
- *Where the switch lives:* this plan puts "Private writing" in the board menu. If 17c built the facilitator bar of spec §13, move it there (Task 7 Step 3).
- *Overlay:* this plan adds its own overlay element for the "•••" marks (`masked-notes.tsx`, `z-index: 3`, positioned from scene coordinates, zoom and scroll). If 17c built an overlay layer for vote badges, render the marks in that layer instead of adding a second one, and keep the two rules: container-relative coordinates, below the canvas UI layer.
- *The board lock of 17c and restore:* restore is facilitator-only, so a locked board does not refuse it. If 17c's lock also blocks the facilitator somewhere, restore must stay allowed.
- *Text freeze during a vote and the reveal:* they cannot overlap (each refuses the other), so no rule combines them.
- *Tombstone purge:* unchanged by this plan. A private tombstone is purged like any other after 24 hours.

**Things only a browser can show** (collected in the walkthrough): that a masked note is drawn empty with its mark and stays so through pan, zoom and remote updates; that the reveal replaces the masked copies without a reload in every tab, the facilitator's included; that the preview canvas shows no library branding and writes nothing; that two canvases on one page (the board and the preview) do not disturb the sticky-note button, which looks for the toolbar inside the board's own container.
