# Whiteboard Secrecy and History (Plan 17d) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A facilitator runs a silent-writing round in which nobody, the facilitator included, receives the text of another person's sticky note before the reveal, and any member brings back an earlier state of the board from automatic or named versions.

**Architecture:** Privacy is a column on the element row (`is_private`), set by the write path while the board's `private_writing` switch is on and cleared only by the reveal. `PresentWhiteboardElement`, already the only serializer of an element, masks a private row for every viewer but its author; a write that touches a private row is broadcast without elements, so each client fetches its own copy. The write path refuses, with reason `private`, anything another member does to a private row or to its binding, with one exception: the new stacking index a canvas gives a row when two rows share one, which the server takes without taking anything else. A version is a row holding the live scene as stored (real text); a queued job stores one five minutes after the first change that follows the last version. Restore rewrites the board from a version inside the board lock, as ordinary element rows with higher versions, so clients converge through the normal delta. A version also remembers which of its elements were private when it was stored (`private_element_ids`); the reveal takes the revealed ones off that list — only for a row that already existed when the version was stored, so an id used again after its tombstone was purged opens nothing — and nothing a version later shows (preview, restore, copy) holds what is left on it: a note deleted while it was hidden.

**Tech Stack:** Laravel 13, PHP 8.4, PostgreSQL, Pest 5, queue worker, Reverb, Inertia 3 + React 19, Wayfinder, `@excalidraw/excalidraw` 0.18.1 (only through `resources/js/lib/whiteboard/excalidraw.ts`).

**Spec:** `docs/superpowers/specs/2026-10-01-whiteboard-design.md` — this plan covers R9 and R10: §11.5, §9, the columns and table of §7 they need (`private_writing`, `is_private`, `last_versioned_seq`, `whiteboard_versions`), version ownership of files in §6.5, the versions rows and the `privateWriting` settings key of §12, the history panel and masked-note marks of §13, and "Private writing" and "Version history" of §16. Read it and `.superpowers/sdd/whiteboard-rules.md` before starting. The spec was edited with this plan (list at the end, "Spec edits made with this plan").

**Prepared in advance, reconciled at `aff67e7`.** A first version of this plan was written at `e0524df`, before plan 17b was finished and without sight of plan 17c. It has been reconciled with the code both plans produced (plans `2026-10-10-plan-17b-whiteboard-templates.md` and `2026-10-11-plan-17c-whiteboard-facilitation.md`, their walkthroughs, and the tree at `aff67e7`). What the reconciliation changed is listed in the last section.

**How the code here was checked:** every task was built once, in order, on a throwaway copy of the tree at `aff67e7`, and the tree was restored afterwards. On that prototype: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards tests/Feature/TranslationKeysTest.php tests/Feature/UuidPrimaryKeysTest.php` passed (541 tests), the complete suite passed (4156 tests), Pint and PHPStan were clean on every touched PHP file, `npm run build` succeeded, `npm run types:check` showed only the known `manage-passkeys.tsx` error and `npx vp check` was clean on the touched frontend files. Every complete file and every snippet in this plan is the prototype's text. **Nothing was run in a browser**: what only a browser can show is listed per frontend task as "Browser checks" and replayed by the walkthrough that follows this plan. Canvas names were read in `node_modules/@excalidraw/excalidraw/dist` (files cited where used). Rule 2 of the implementers' rules still applies: if something here fails, fix the smallest thing that makes the tests and the spec true, and report it.

**Corrected after an adversarial check (two findings, both confirmed by reading the code).** These corrections were written after the prototype was thrown away: their code was **not** built, type-checked or run. They are: in Task 2, rule 5 with `indexRepairOfHidden()`, its two tests and the `$isIndexRepair` argument of `refusal()`; in Task 3, `revealInVersions()` with its age check and the test "keeps a note deleted while hidden out of a version when its id is used again"; in Task 7, the change to `scene-sync.ts` and the new `onRejected`. Follow TDD on them as on everything else and expect to adjust details (rule 2 of the implementers' rules); the behaviour the tests describe is what is binding.

## Global Constraints

- No new dependency, PHP or JS. No JavaScript test runner: client logic stays thin, rules live on the server.
- Every primary and foreign key is a UUID (`tests/Feature/UuidPrimaryKeysTest.php`). Migrations have `up` only. This plan's migration is dated `2026_10_12_100000`, after the last whiteboard migration on the branch (`2026_10_11_100000_add_whiteboard_facilitation.php`).
- Facilitation UI follows plan 17c: facilitator tools live in `facilitator-bar.tsx` (in the top bar, facilitator only), what everyone must know in the status row (`<StatusBar>` in `board.tsx`), overlays above the canvas use `use-whiteboard-overlay.ts` and `z-[3]`, and a request that may fail goes through `useWhiteboardRequest()` (toast with the server's message).
- Request bodies are snake_case (`private_writing`); Excalidraw elements keep camelCase. Route names are camelCase segments, URLs kebab-case, controllers plural with CRUD method names, one controller per non-CRUD action.
- Every UI string goes through `__()` / `t()` with its key in `lang/en.json`, `fr.json`, `de.json`, `es.json` (`tests/Feature/TranslationKeysTest.php`). Each task lists the keys it adds, with translations. `lang/*.json` are not sorted: append.
- The board UI never names the canvas library and shows none of its branding; overlays never cover canvas controls, the reactions bar or the shapes toolbar.
- **The secrecy invariant (spec §11.5):** the text of another member's private sticky never leaves the server — snapshot, Inertia page, `GET elements`, `rejected` copies, `elements.changed`, versions, duplicate, template, vote results, log lines — for the facilitator too. A note deleted while it was hidden is never shown at all: not by the reveal, not by a version stored while it was live. Every test of a surface uses `whiteboardPayloadExposes()` (Task 1). No code in this plan passes an element, a scene or a version to `Log::`, to an exception message or to a broadcast.
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

1. **A member holds a masked note and their canvas sends it back** — unchanged (a retry), edited (they dragged or typed on it), deleted (eraser, "clear canvas"), with a lower nonce, re-indexed (the canvas repaired a duplicate stacking index, which nobody asked for), or as the facilitator. The author's text must survive every one of them. Everything but the index repair is refused and the sender's canvas returns to the masked copy; the index repair is accepted as an index and nothing else, or every canvas but the author's would send it again at every flush, with a toast and a closed text editor each time. Pinned in Task 2: "refuses every change another member makes to a private note and keeps the text", "takes the new index a canvas gives a hidden note of someone else, and nothing else" and "takes nothing but an index from the canvas of another member".
2. **The text of a note reaches the server without its container** (the container was rejected, or the batch was split between the two) while private writing is on. It must not be broadcast or served in clear. Pinned in Task 2: "treats a bound text whose container is unknown as private while private writing is on".
3. **The database refuses a statement that carries note text** (deadlock, constraint, lost connection). Laravel's `QueryException` message contains the statement with its bindings, and PostgreSQL adds the failing row: the report must hold neither. Pinned in Task 2: "keeps the text of a note out of the log, even when the database refuses the write", and in Task 4: "keeps the scene out of the log when a version cannot be stored".
4. **A note is deleted while it is hidden.** The reveal must not show it, a later write by its author that leaves it deleted must not make its tombstone public, and a version stored while it was still on the board must never preview, restore or copy it. Pinned in Task 3: "never shows a private note that was deleted before the reveal" and "lets a version stored while the notes were hidden show what the reveal showed, and nothing else"; in Task 5: "never previews a note that was deleted before the reveal"; in Task 6: "never restores or copies a note that was deleted before the reveal". The list of a version is keyed by element id, and an id is free again once its tombstone is purged (24 hours): anyone who saw the masked copy knows the id and could write a new private note under it and have it revealed. The reveal therefore only takes an id off a version's list when the revealed row is not younger than the version. Pinned in Task 3: "keeps a note deleted while hidden out of a version when its id is used again".
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
| `app/Actions/Whiteboards/DuplicateWhiteboard.php`, `SaveWhiteboardTemplate.php`, `OpenWhiteboardVote.php` (modify) | Blocked while private writing is on |
| `app/Actions/Whiteboards/StoreWhiteboardVersion.php` | Live scene → version row; retention |
| `app/Actions/Whiteboards/ScheduleWhiteboardVersion.php` | First change after the last version → delayed job |
| `app/Jobs/StoreAutomaticWhiteboardVersion.php` | The delayed job |
| `app/Actions/Whiteboards/QueueMissedWhiteboardVersions.php`, `app/Console/Commands/PruneWhiteboardsCommand.php` (modify) | Daily catch-up |
| `app/Actions/Whiteboards/PruneWhiteboardFiles.php` (modify) | A version keeps its images alive |
| `app/Actions/Whiteboards/PresentWhiteboardVersion.php` | List item of a version |
| `app/Actions/Whiteboards/ReadWhiteboardVersion.php` | The elements a version may show |
| `app/Http/Controllers/Whiteboards/WhiteboardVersionsController.php` | index, store, show, update, destroy |
| `app/Actions/Whiteboards/RestoreWhiteboardVersion.php`, `app/Http/Controllers/Whiteboards/WhiteboardVersionRestoresController.php` | Restore |
| `app/Actions/Whiteboards/CopyWhiteboardVersion.php`, `app/Http/Controllers/Whiteboards/WhiteboardVersionCopiesController.php` | Copy to a new board |
| `routes/web.php` (modify) | Seven routes |
| `tests/Pest.php` (modify) | Helpers shared by the test files below |

Frontend (new unless marked):

| Path | Responsibility |
|---|---|
| `resources/js/lib/whiteboard/types.ts` (modify) | `privateWriting`, reason `private`, version types |
| `resources/js/lib/whiteboard/scene-sync.ts` (modify) | `onRejected` also says which element was refused |
| `resources/js/hooks/use-whiteboard-overlay.ts` (modify) | `useMaskedNoteBoxes` |
| `resources/js/components/whiteboard/masked-notes.tsx` | "•••" marks above masked notes |
| `resources/js/components/whiteboard/facilitator-bar.tsx` (modify) | The private-writing button; no vote while it is on |
| `resources/js/components/whiteboard/board-menu.tsx` (modify) | Duplicate and save-as-template disabled while it is on |
| `resources/js/lib/whiteboard/appearance.ts` | Canvas locale and theme, shared by the board and the preview |
| `resources/js/components/whiteboard/history-panel.tsx`, `version-preview.tsx` | History panel, read-only preview |
| `resources/js/components/whiteboard/board.tsx` (modify) | Status-row sentence, marks, history button and panel, resync on reveal |
| `resources/css/app.css` (modify) | The preview canvas shows no menu and no help button |

Shared shapes used by several tasks:

```
VersionScene   = array{elements: list<array<string, mixed>>, fileIds: list<string>}      (whiteboard_versions.scene)
private_element_ids = list<string>   (whiteboard_versions column: ids of `scene.elements` that were private when stored and not revealed since;
                                      an id leaves the list only when the revealed row is not younger than the version)
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
- Because the bound text is deleted locally, the canvas draws the note empty; the "•••" mark is skrum's overlay (Task 7), in the layer plan 17c built for vote badges.
- `reconcileElements` keeps the local copy only when it is being edited, has a higher version, or has the same version and a **lower** nonce (`dist/dev/index.js`, lines 32828–32837, `shouldDiscardRemoteElement`). After the reveal the real copy arrives with the same version and the same nonce as the masked one, so it replaces it. The reveal therefore changes no version: it only gives the revealed rows a new `seq` so that `GET elements?since=` returns them.
- If the canvas does change a masked copy (drag, erase, typing creates a new bound text), the write is refused with reason `private` and `scene-sync.ts` forces the server's masked copy back (`settle` → `force`), or drops the element the server never had (`dropLocally`).
- **One write of a masked copy is not a user's doing: the repair of a duplicate index.** The canvas generates indices without jitter (`generateNKeysBetween`, `chunk-4FTI6OG3.js` lines 15471 and 15671), so two members who each add a note before seeing the other's give the note, and its text, the same index — the ordinary case in a silent-writing round, where every write is ids-only and reaches the others a refetch later. `reconcileElements` (`dist/dev/index.js`, lines 32886–32888) and `Scene.replaceAllElements` (`chunk-4FTI6OG3.js`, lines 22668–22669) both run `syncInvalidIndices`, which gives the element with the greater id (order: index, then id, lines 15530–15541) a new index and, through `mutateElement`, a new version — whoever wrote it. `scene-sync.ts` then queues it (`handleChange`: its stamp no longer equals `known`). If the server refused that write, `force` would put the duplicate index back, the canvas would repair it again, and the `PUT` would repeat at every flush until the author's own canvas landed the same repair — never, if the author has left. So the server accepts it (Task 2, rule 5): it stores **its own data** with the new index, version and nonce. The masked text arrives as the canvas holds it — empty and locally deleted — and neither of those is taken. Not reproduced in a browser; derived from the code cited (browser check B7.11).

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
  - `WhiteboardVersion` (`id`, `whiteboard_id`, `name: ?string`, `scene: VersionScene`, `private_element_ids: list<string>`, `seq: int`, `created_by_member_id: ?string`, `created_at`; no `updated_at`), constants `WhiteboardVersion::MaxNamed = 100`, `WhiteboardVersion::KeptAutomatic = 50`, `isAutomatic(): bool`, `createdBy(): BelongsTo<WhiteboardMember>`, `whiteboard(): BelongsTo<Whiteboard>`; factory state `->named(string $name = 'Checkpoint')`.
  - Snapshot key `board.privateWriting: bool`.
  - A board filled by `CopyWhiteboardScene` has `last_versioned_seq === seq`.
  - Test helpers in `tests/Pest.php`: `stickyWithText(string $id, string $text): array{0: array, 1: array}`, `storeWhiteboardElement(Whiteboard $board, array $data, int $seq, ?WhiteboardMember $author = null, bool $private = false): WhiteboardElement`, `putWhiteboardElements(mixed $test, Whiteboard $board, array $elements): TestResponse`, `whiteboardViewer(mixed $test, User|WhiteboardMember $viewer): mixed`, `whiteboardPayloadExposes(mixed $payload, string $secret): bool`, `privateWritingBoard(): array{board: Whiteboard, facilitator: User, author: User, authorMember: WhiteboardMember, other: User, otherMember: WhiteboardMember, guest: WhiteboardMember, secret: string}`.

- [ ] **Step 1: Add the shared test helpers**

Append to `tests/Pest.php`, after `sceneElement()` (the last function of the file). Every class used here — `User`, `Whiteboard`, `WhiteboardElement`, `WhiteboardMember`, `TestResponse` — is already imported. Plan 17c's `whiteboardSticky()` stores a note and its text as rows without an author; the helpers below build the wire form (`stickyWithText`) and store a row with an author and a privacy flag (`storeWhiteboardElement`), which is what this plan's tests need. None of these names exists in `tests/Pest.php` or in a test file (checked with `grep -rn '^function ' tests`).

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
        'private_element_ids' => ['box'],
    ]);

    expect(Str::isUuid($automatic->id))->toBeTrue()
        ->and(Schema::hasColumn('whiteboard_versions', 'updated_at'))->toBeFalse()
        ->and($automatic->fresh()->created_at->toDateTimeString())->toBe('2026-10-12 10:00:00')
        ->and($automatic->fresh()->isAutomatic())->toBeTrue()
        ->and($automatic->fresh()->seq)->toBe(4)
        ->and($automatic->fresh()->private_element_ids)->toBe([])
        ->and($named->fresh()->isAutomatic())->toBeFalse()
        ->and($named->fresh()->scene['elements'][0]['id'])->toBe('box')
        ->and($named->fresh()->private_element_ids)->toBe(['box'])
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
            $table->json('private_element_ids');
            $table->unsignedBigInteger('seq');
            $table->foreignUuid('created_by_member_id')->nullable()->constrained('whiteboard_members')->nullOnDelete();
            $table->timestamp('created_at')->nullable();

            $table->index(['whiteboard_id', 'created_at']);
        });
    }
};
```

`private_element_ids` has no database default (PostgreSQL allows none that Laravel's `json` column can express portably): the factory and `StoreWhiteboardVersion` (Task 4) always set it. The `update` gives every existing board `last_versioned_seq = seq`: "nothing to version yet", so that its next write is "the first write after the last version" and schedules one (Task 4). Without it an existing board with content would never get an automatic version.

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
 * `private_element_ids` lists the elements that were private then and have
 * not been revealed since: nothing may show them (spec §9). A null name
 * means the version was stored automatically.
 *
 * @phpstan-type VersionScene array{elements: list<array<string, mixed>>, fileIds: list<string>}
 *
 * @property string $id
 * @property string $whiteboard_id
 * @property string|null $name
 * @property VersionScene $scene
 * @property list<string> $private_element_ids
 * @property int $seq
 * @property string|null $created_by_member_id
 * @property Carbon $created_at
 * @property-read Whiteboard $whiteboard
 * @property-read WhiteboardMember|null $createdBy
 */
#[Fillable(['whiteboard_id', 'name', 'scene', 'private_element_ids', 'seq', 'created_by_member_id'])]
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
            'private_element_ids' => 'array',
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
            'private_element_ids' => [],
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

In `app/Models/Whiteboard.php`: add `@property bool $private_writing` and `@property int $last_versioned_seq` to the docblock (after `$purged_seq`); add `'private_writing'` and `'last_versioned_seq'` at the end of the `#[Fillable([...])]` list (it already holds plan 17c's `locked`, `follow_enabled`, `timer_ends_at`: keep them); add `'private_writing' => 'boolean'` and `'last_versioned_seq' => 'integer'` to `casts()`; add the relation:

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

In `app/Actions/Whiteboards/BuildWhiteboardSnapshot.php` add ` *         privateWriting: bool,` to the `board` shape of the `@phpstan-type Snapshot`, after the `followEnabled: bool,` line, and, in the `board` array, after `'followEnabled' => $board->follow_enabled,`:

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
- Consumes (existing): `PresentWhiteboardElement::handle(WhiteboardElement $element, WhiteboardMember $viewer): array`; `WriteWhiteboardElements::handle(Whiteboard $board, WhiteboardMember $member, array $rawElements): array{seq: int, fromSeq: int, rejected: list<array{id: ?string, reason: string, element: ?array}>}` as plan 17c left it (constructor with `PresentWhiteboardVoting`, the deferral queue of the voting freeze, `storedElements(Whiteboard, array, bool $withContainers)`, `refusal(?WhiteboardElement, array, bool, Collection, int)`, `save(Whiteboard, WhiteboardMember, ?WhiteboardElement, array, int)`); `WhiteboardElementsChanged(string $boardId, int $seq, int $fromSeq, ?array $elements)`.
- Produces:
  - Masked wire shape (see "Wire shape of a private note" above) from `PresentWhiteboardElement::handle`, unchanged signature.
  - Rejection reason `'private'`.
  - An index repair of a private row by a member who is not its author is accepted: the row keeps its stored data and takes the incoming `index`, `version`, `versionNonce` and `updated` (rule 5).
  - `KeepWhiteboardTextOutOfLogs::handle(string $boardId, Closure $work): mixed` — runs `$work`, turning a `QueryException` into `WhiteboardQueryFailed`.
  - `App\Exceptions\WhiteboardQueryFailed(string $boardId, string $sqlState)`.

**Rules implemented here** (spec §11.5; the board row is locked, `$existing` is the stored row of the incoming element, `$container` the stored row its `containerId` names — rows saved earlier in the same batch count as stored):

1. *Refusal `private`*, checked inside `refusal()` right after `stale` and before `locked`, for the facilitator too (plan 17c's `voting` reasons are decided after `refusal()` and stay where they are; its 403 on a locked board comes before any element is looked at):
   - `$existing` is private and its author is not the writer (edit, move, delete, re-bind, detach, restore of a tombstone) — unless the write is an index repair (rule 5), which skips the whole of rule 1;
   - `$container` is private and its author is not the writer (binding a text to someone else's private note);
   - `$container` is private and `$existing` exists with another author (a private note only takes text written by its own author).
2. *Privacy of the saved row*: while the board's `private_writing` is off, true only for a private row that the write leaves deleted (a note deleted while it was hidden stays private until its author brings it back), false otherwise. While it is on, true when `$existing` is private, or `$container` is private, or the element is new and is either a sticky note (it carries the sticky marker) or a text with a `containerId` whose container is not stored. A write never clears the flag while private writing is on.
3. *Broadcast*: when any accepted row is private, `elements` is null (ids-only form), whatever the size.
4. A masked copy sent back unchanged has the stored `version` and `versionNonce`: the existing "same write" rule ignores it. A masked copy with a higher nonce is `stale`. Neither reaches rule 1, and neither changes anything.
5. *Index repair* (see "One write of a masked copy is not a user's doing" at the top of this plan). A write of a private row by a member who is not its author is an index repair when all of this holds:
   - its `index` is a string, and its `version` is the stored one or the stored one plus one (a client cannot push a hidden note towards the highest version number);
   - its `index` differs from the stored one, **or** its `version` is the stored one (same version, lower nonce: another canvas landed the same repair first, and the canvas's own rule lets the lower nonce win);
   - for a text, `text` and `originalText` are empty (the masked form);
   - nothing else differs from the stored data, leaving aside `index`, `version`, `versionNonce`, `updated` and, for a text, `text`, `originalText` and `isDeleted` (the canvas holds a masked text as a deleted one). Numbers are compared loosely (`10` and `10.0` are the same coordinate).

   It is then saved as **the stored data** with the incoming `index`, `version`, `versionNonce` and `updated`: text, deletion state, position, binding and author are the stored ones, `is_private` stays, the broadcast is ids-only. From there on the loop treats it as that element, so the live count and the voting checks see no change. A masked copy sent with `version + 1` and the stored index (an erased masked text looks like this) is not a repair: rule 1 refuses it.

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

it('takes the new index a canvas gives a hidden note of someone else, and nothing else', function () {
    $table = privateWritingBoard();
    $board = $table['board'];
    [$own, $ownText] = stickyWithText('early', 'Typed at the same time');
    storeWhiteboardElement($board, $own, 3, $table['otherMember'], private: true);
    storeWhiteboardElement($board, $ownText, 4, $table['otherMember'], private: true);
    $board->update(['seq' => 4]);
    [$note, $masked] = stickyWithText('note', '');

    $repair = putWhiteboardElements($this->actingAs($table['other']), $board, [
        [...$note, 'customData' => ['skrum' => ['kind' => 'sticky', 'masked' => true]], 'index' => 'a1V', 'version' => 2, 'versionNonce' => 7, 'updated' => 1760263200000],
        [...$masked, 'isDeleted' => true, 'index' => 'a2V', 'version' => 2, 'versionNonce' => 8, 'updated' => 1760263200000],
    ])
        ->assertOk()
        ->assertExactJson(['seq' => 6, 'fromSeq' => 4, 'rejected' => []]);

    $storedNote = $board->elements()->where('element_id', 'note')->sole();
    $storedText = $board->elements()->where('element_id', 'note-text')->sole();

    expect($storedNote->data['index'])->toBe('a1V')
        ->and($storedNote->data['x'])->toBe(10)
        ->and($storedNote->data['customData'])->toBe(['skrum' => ['kind' => 'sticky']])
        ->and($storedNote->version)->toBe(2)
        ->and($storedNote->version_nonce)->toBe(7)
        ->and($storedNote->data['version'])->toBe(2)
        ->and($storedNote->is_private)->toBeTrue()
        ->and($storedNote->author_member_id)->toBe($table['authorMember']->id)
        ->and($storedText->data['index'])->toBe('a2V')
        ->and($storedText->data['text'])->toBe($table['secret'])
        ->and($storedText->data['originalText'])->toBe($table['secret'])
        ->and($storedText->data['isDeleted'])->toBeFalse()
        ->and($storedText->is_deleted)->toBeFalse()
        ->and($storedText->version)->toBe(2)
        ->and($storedText->version_nonce)->toBe(8)
        ->and($storedText->seq)->toBe(6)
        ->and($storedText->is_private)->toBeTrue()
        ->and($storedText->author_member_id)->toBe($table['authorMember']->id)
        ->and(elementsChangedPayloads())->toBe([['seq' => 6, 'fromSeq' => 4]])
        ->and(whiteboardPayloadExposes($repair->getContent(), $table['secret']))->toBeFalse();

    $this->actingAs($table['author'])
        ->getJson(route('whiteboards.elements.index', [$board, 'since' => 4]))
        ->assertOk()
        ->assertJsonPath('elements.0.id', 'note')
        ->assertJsonPath('elements.0.index', 'a1V')
        ->assertJsonPath('elements.1.index', 'a2V')
        ->assertJsonPath('elements.1.version', 2)
        ->assertJsonPath('elements.1.text', $table['secret']);

    $masked = $this->actingAs($table['other'])
        ->getJson(route('whiteboards.elements.index', [$board, 'since' => 4]))
        ->assertOk()
        ->assertJsonPath('elements.1.index', 'a2V')
        ->assertJsonPath('elements.1.versionNonce', 8)
        ->assertJsonPath('elements.1.text', '');

    expect(whiteboardPayloadExposes($masked->getContent(), $table['secret']))->toBeFalse();
});

it('takes nothing but an index from the canvas of another member', function (string $viewer) {
    $table = privateWritingBoard();
    $board = $table['board'];
    $request = fn () => whiteboardViewer($this, $table[$viewer]);
    [$note, $masked] = stickyWithText('note', '');

    putWhiteboardElements($request(), $board, [
        [...$note, 'index' => 'a1V', 'version' => 2, 'x' => 900],
        [...$masked, 'index' => 'a2V', 'version' => 2, 'text' => 'Overwritten', 'originalText' => 'Overwritten'],
    ])
        ->assertOk()
        ->assertJsonPath('seq', 2)
        ->assertJsonPath('rejected.0.id', 'note')
        ->assertJsonPath('rejected.0.reason', 'private')
        ->assertJsonPath('rejected.0.element.index', 'a1')
        ->assertJsonPath('rejected.1.id', 'note-text')
        ->assertJsonPath('rejected.1.reason', 'private')
        ->assertJsonPath('rejected.1.element.index', 'a2');

    putWhiteboardElements($request(), $board, [
        [...$note, 'index' => 'a1V', 'version' => 2, 'isDeleted' => true],
        [...$masked, 'index' => 'a2V', 'version' => 2, 'containerId' => null],
        [...$masked, 'index' => 'a2V', 'version' => 3],
        [...$note, 'index' => 'a1V', 'version' => 2147483647],
    ])
        ->assertOk()
        ->assertJsonPath('seq', 2)
        ->assertJsonCount(4, 'rejected')
        ->assertJsonPath('rejected.0.reason', 'private')
        ->assertJsonPath('rejected.1.reason', 'private')
        ->assertJsonPath('rejected.2.reason', 'private')
        ->assertJsonPath('rejected.3.reason', 'private');

    expect($board->elements()->orderBy('seq')->pluck('version')->all())->toBe([1, 1])
        ->and($board->elements()->where('element_id', 'note')->sole()->data['index'])->toBe('a1')
        ->and($board->elements()->where('element_id', 'note-text')->sole()->data['index'])->toBe('a2');

    Event::assertNotDispatched(WhiteboardElementsChanged::class);

    putWhiteboardElements($request(), $board, [[...$masked, 'versionNonce' => 50]])
        ->assertOk()
        ->assertExactJson(['seq' => 3, 'fromSeq' => 2, 'rejected' => []]);

    $storedText = $board->elements()->where('element_id', 'note-text')->sole();

    expect($storedText->version)->toBe(1)
        ->and($storedText->version_nonce)->toBe(50)
        ->and($storedText->data['text'])->toBe($table['secret'])
        ->and($storedText->is_private)->toBeTrue()
        ->and(elementsChangedPayloads())->toBe([['seq' => 3, 'fromSeq' => 2]]);
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

Notes on the two index tests: `sceneElement()` gives every element `versionNonce` 100, so `'versionNonce' => 50` is the same version with a lower nonce — what a second canvas sends when another one landed the same repair first. `[...$masked, 'isDeleted' => true]` is the masked text as a canvas holds it (see the top of this plan). `updated` is sent with a new value, as a canvas does, and is one of the four keys taken.

Notes on the last test: the check constraint lives in the test's transaction and is rolled back with it. The failing `update` runs inside `DB::transaction` at a nested level, so Laravel rolls back to its savepoint and the test's own transaction stays usable. PostgreSQL's message for a check violation contains the failing row ("Failing row contains (…)"), which is exactly what must not reach the log.

- [ ] **Step 2: Run it to see it fail**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards/WhiteboardPrivateWritingTest.php`
Expected: FAIL — the first test reports `note => false`; the masking tests find the secret in the snapshot; the index test finds the masked text stored over the real one (`text` is empty); the log test finds it in the `QueryException` message.

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

Edit `app/Actions/Whiteboards/WriteWhiteboardElements.php`. Everything plan 17c put there (the deferral queue, `targets`, `isWordsOfTarget`, `changesWordsOfTarget`, `rebindsWordsOfTarget`, the `vote.changed` broadcast) stays as it is.

a. Constructor: add a fifth dependency, after `PresentWhiteboardVoting`.

```php
        private PresentWhiteboardVoting $presentWhiteboardVoting,
        private KeepWhiteboardTextOutOfLogs $keepWhiteboardTextOutOfLogs,
```

b. `handle()`: wrap the existing transaction, body unchanged. The first line becomes

```php
        return $this->keepWhiteboardTextOutOfLogs->handle($board->id, fn (): array => DB::transaction(function () use ($board, $member, $rawElements): array {
```

and the closing `});` of the transaction becomes `}));`.

c. Containers are always loaded. The private rules read the row a text is bound to whether or not a vote is open, so `storedElements()` loses its third parameter: the call becomes

```php
            $stored = $this->storedElements($locked, $rawElements);
```

the signature becomes `private function storedElements(Whiteboard $board, array $rawElements): Collection`, and these four lines of its body are deleted (the rest, which loads the containers named by the batch and by the stored rows, is unchanged):

```php
        if (! $withContainers) {
            return $stored;
        }

```

With no vote open the extra rows change nothing else: `targets()` returns `[]` for a null session.

d. Inside the loop: the container is resolved right after `$existing`; an index repair (rule 5) is recognised right after the "same write" check and, from there on, **replaces** `$element`; the calls to `refusal()` and `save()` take the new arguments.

```php
                $existing = $stored->get($element['id']);
                $container = $this->container($element, $stored);

                if ($this->isSameWrite($existing, $element)) {
                    continue;
                }

                $indexRepair = $this->indexRepairOfHidden($existing, $element, $member);
                $element = $indexRepair ?? $element;
```

(the `isSameWrite` block is the existing one, shown for position; the deferral of plan 17c follows, unchanged.)

```php
                $reason = $this->refusal($existing, $container, $element, $member, $indexRepair !== null, $isFacilitator, $fileIds, $liveCount);
```

```php
                $saved = $this->save($locked, $member, $existing, $element, $seq, $this->isPrivate($locked, $existing, $container, $element));
```

Rows saved earlier in the batch are in `$stored` (`$stored->put(...)` after each save), so a text that follows its note in the batch finds the note as its container.

e. `refusal()` gains the container and the writer, and the `private` reason after `stale`:

```php
    private function refusal(?WhiteboardElement $existing, ?WhiteboardElement $container, array $element, WhiteboardMember $member, bool $isIndexRepair, bool $isFacilitator, Collection $fileIds, int $liveCount): ?string
    {
        if ($this->isStale($existing, $element)) {
            return 'stale';
        }

        if (! $isIndexRepair && $this->touchesPrivate($existing, $container, $member)) {
            return 'private';
        }
```

(the `locked`, `file` and `full` checks follow, unchanged). A repaired element carries the incoming version and nonce, so `stale` is decided on what the client sent; it carries the stored `locked`, so a hidden element that is locked still answers `locked` to a member who is not the facilitator, as any locked element does today.

f. New private methods, placed before `isStale()`:

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
     * A canvas that holds two elements with the same index gives one of
     * them a new index and a new version, whoever wrote it. From a member
     * who is not the author of a hidden element the server takes that
     * index and nothing else: its own data with the new index, version
     * and nonce (spec §11.5). Null when the write is anything more.
     *
     * @param  array<string, mixed>  $element
     * @return array<string, mixed>|null
     */
    private function indexRepairOfHidden(?WhiteboardElement $existing, array $element, WhiteboardMember $member): ?array
    {
        if (! $existing?->is_private || $existing->author_member_id === $member->id) {
            return null;
        }

        if (! is_string($element['index'] ?? null) || $element['version'] > $existing->version + 1) {
            return null;
        }

        if ($element['index'] === ($existing->data['index'] ?? null) && $element['version'] !== $existing->version) {
            return null;
        }

        $isText = $existing->type === 'text';

        if ($isText && (($element['text'] ?? '') !== '' || ($element['originalText'] ?? '') !== '')) {
            return null;
        }

        $ignored = array_flip($isText ? [...self::IndexRepairKeys, ...self::MaskedTextKeys] : self::IndexRepairKeys);

        // Loose on purpose: 10 and 10.0 are the same coordinate.
        if (array_diff_key($element, $ignored) != array_diff_key($existing->data, $ignored)) {
            return null;
        }

        return [...$existing->data, ...array_intersect_key($element, array_flip(self::IndexRepairKeys))];
    }

    /**
     * A write gives privacy and never takes it away while private writing
     * is on; only the reveal clears it. A new text whose container is not
     * stored yet is private too: it may be the text of a note still on its
     * way. Once the notes are revealed, a note deleted while it was hidden
     * stays private until its author brings it back.
     *
     * @param  array<string, mixed>  $element
     */
    private function isPrivate(Whiteboard $board, ?WhiteboardElement $existing, ?WhiteboardElement $container, array $element): bool
    {
        if (! $board->private_writing) {
            return (bool) $existing?->is_private && $element['isDeleted'];
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

and two constants, after `MaxBroadcastBytes`:

```php
    private const IndexRepairKeys = ['index', 'version', 'versionNonce', 'updated'];

    /**
     * What a canvas holds differently for a masked text: it is empty, and
     * restoring an empty text marks it deleted.
     */
    private const MaskedTextKeys = ['text', 'originalText', 'isDeleted'];
```

Why `indexRepairOfHidden()` is safe: what it returns is the stored data except for four keys, none of which is text; `isPrivate()` keeps the flag (`$existing` is private; with private writing off the row is a tombstone and the repaired element is still deleted); `save()` updates the existing row, so the author does not change; `liveDelta()` is 0. A version lower than the stored one, or the same version with a higher nonce, is still `stale`. The comparison assumes the stored data went through a canvas (every private row does: it is created by the write path), so the keys a canvas adds when it restores an element are already there; if a field the canvas normalises ever differs, the write is refused as before this rule — the loop of the finding, not a leak.

g. `save()` takes the flag: add the parameter `bool $private` at the end of its signature and `'is_private' => $private,` to `$attributes` (after `'is_sticky'`).

h. `broadcastable()` starts with the ids-only rule:

```php
        if (array_any($accepted, fn (WhiteboardElement $element): bool => $element->is_private)) {
            return null;
        }
```

(`array_any` is PHP 8.4, like `array_all` already used in `SanitizeWhiteboardElement`.)

What rule 2 means once the notes are revealed: a private tombstone its author brings back becomes an ordinary note; a write of the author that leaves it deleted (the canvas repairing an index, for instance) keeps it private, so its text never appears in a delta; and before either write `touchesPrivate()` still protects it from everyone else, because it reads the row's flag, not the board's.

A consequence to know, not a defect: a label typed into a plain shape while private writing is on is public when the shape reaches the server first (the canvas sends a container before its text) and hidden until the reveal when the label arrives alone. The rule errs on the side of hiding.

- [ ] **Step 6: Run the tests**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards`
Expected: PASS, the existing write, delta, snapshot, event, lock and voting tests included (none of their rows is private; the voting write tests of plan 17c exercise the same loop).

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
- Modify: `app/Actions/Whiteboards/WhiteboardGuard.php`, `app/Http/Controllers/Whiteboards/WhiteboardSettingsController.php`, `app/Actions/Whiteboards/DuplicateWhiteboard.php`, `app/Actions/Whiteboards/SaveWhiteboardTemplate.php`, `app/Actions/Whiteboards/OpenWhiteboardVote.php`, `lang/{en,fr,de,es}.json`
- Test: `tests/Feature/Whiteboards/WhiteboardPrivateWritingSwitchTest.php`

**Interfaces:**
- Consumes: Tasks 1–2; `WhiteboardChanged(string $boardId)`, `WhiteboardElementsChanged(string $boardId, int $seq, int $fromSeq, ?array $elements)`; `WhiteboardGuard::facilitator`, `::notGuest`; `DuplicateWhiteboard::handle(Whiteboard, User): Whiteboard`; `SaveWhiteboardTemplate::handle(Whiteboard, User, string, ?string): WhiteboardTemplate`.
- Produces:
  - `PATCH whiteboards/{board}/settings` accepts `private_writing: bool` (facilitator; 204; `board.changed`, and `elements.changed` in the ids-only form when a note was revealed).
  - `SetWhiteboardPrivateWriting::handle(Whiteboard $locked, bool $on): void` — the caller holds the lock on the board row.
  - `WhiteboardGuard::notPrivateWriting(Whiteboard $board): void` — throws a `ValidationException` (422) whose message is "Reveal the notes first.". Used by Tasks 5 and 6.
  - `POST duplicate`, `POST template` and `POST vote-sessions` answer 422 "Reveal the notes first." while private writing is on; `PATCH settings {private_writing: true}` answers 422 "Close the vote first." while a vote is open.
  - The reveal removes the revealed element ids from `private_element_ids` of every version of the board, for the rows that are not younger than the version (`whiteboard_elements.created_at <= whiteboard_versions.created_at`).

**The reveal, precisely** (spec §11.5, inside the lock):
1. Every **live** private row of the board gets `is_private = false` and `seq = board.seq + 1` (one statement, one new seq for all of them). Versions and nonces do not change.
2. Private **tombstones** keep their flag: a note deleted while hidden is never shown. They stay masked in `GET elements` until the nightly purge removes them; `ReadWhiteboardScene` only reads live rows, so no copy holds them.
3. Every version of the board whose `private_element_ids` is not empty loses from that list the revealed ids **whose row is not younger than the version** (versions read with `get(['id', 'private_element_ids', 'created_at'])`: the scenes are not loaded). What stays listed was deleted before the reveal — or is a different element under the same id. The list is keyed by id, and an id is free again once `PurgeWhiteboardTombstones` has removed its tombstone (24 hours after the deletion); every member received the id in the masked copy. Without the age check a member could write a new private note under the id of a note deleted while hidden, have it revealed, and read the deleted text in an old version — named and "Before restore" versions never expire. A row that was on the board when a version was stored was created before it; a row created under a purged id is at least 24 hours younger. Both `created_at` columns have a precision of one second, hence `<=`.
4. The board gets `private_writing = false` and, when at least one row was revealed, the new `seq`.
5. After the commit: `elements.changed` `{seq, fromSeq}` (no elements) when a row was revealed, then `board.changed`. The text reaches a client only through `GET elements?since=` or the snapshot.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Whiteboards/WhiteboardPrivateWritingSwitchTest.php`:

```php
<?php

use App\Actions\Whiteboards\PurgeWhiteboardTombstones;
use App\Events\Whiteboards\WhiteboardChanged;
use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardTemplate;
use App\Models\WhiteboardVersion;
use App\Models\WhiteboardVoteSession;
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

    putWhiteboardElements($this->actingAs($table['author']), $board, [[...$text, 'version' => 3, 'isDeleted' => true, 'index' => 'a2V']])
        ->assertJsonPath('rejected', []);

    $rewritten = $this->actingAs($table['other'])->getJson(route('whiteboards.elements.index', [$board, 'since' => 4]))->assertOk();

    expect($tombstone->fresh()->is_private)->toBeTrue()
        ->and($tombstone->fresh()->version)->toBe(3)
        ->and(whiteboardPayloadExposes($rewritten->getContent(), $table['secret']))->toBeFalse();

    putWhiteboardElements($this->actingAs($table['author']), $board, [[...$text, 'version' => 4]])
        ->assertJsonPath('rejected', []);

    expect($tombstone->fresh()->is_private)->toBeFalse()
        ->and($tombstone->fresh()->is_deleted)->toBeFalse();

    $this->actingAs($table['other'])
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('elements.1.text', $table['secret']);
});

it('lets a version stored while the notes were hidden show what the reveal showed, and nothing else', function () {
    $table = privateWritingBoard();
    $board = $table['board'];
    $version = WhiteboardVersion::factory()->create([
        'whiteboard_id' => $board->id,
        'private_element_ids' => ['dropped', 'dropped-text', 'note', 'note-text'],
    ]);
    $untouched = WhiteboardVersion::factory()->named()->create(['whiteboard_id' => $board->id]);
    $elsewhere = WhiteboardVersion::factory()->create(['private_element_ids' => ['note', 'note-text']]);

    setPrivateWriting($this->actingAs($table['facilitator']), $board, false)->assertNoContent();

    expect($version->fresh()->private_element_ids)->toBe(['dropped', 'dropped-text'])
        ->and($untouched->fresh()->private_element_ids)->toBe([])
        ->and($elsewhere->fresh()->private_element_ids)->toBe(['note', 'note-text']);
});

it('keeps a note deleted while hidden out of a version when its id is used again', function () {
    $this->travelTo('2026-10-12 10:00:00');

    $table = privateWritingBoard();
    $board = $table['board'];
    [$note, $text] = stickyWithText('note', $table['secret']);

    $this->travel(5)->minutes();

    $version = WhiteboardVersion::factory()->named()->create([
        'whiteboard_id' => $board->id,
        'scene' => ['elements' => [$note, $text], 'fileIds' => []],
        'private_element_ids' => ['note', 'note-text'],
    ]);

    $this->travel(5)->minutes();

    putWhiteboardElements($this->actingAs($table['author']), $board, [
        [...$text, 'version' => 2, 'isDeleted' => true],
        [...$note, 'version' => 2, 'isDeleted' => true],
    ])->assertJsonPath('rejected', []);

    $this->travel(2)->days();

    expect(app(PurgeWhiteboardTombstones::class)->handle())->toBe(2)
        ->and($board->elements()->count())->toBe(0);

    putWhiteboardElements($this->actingAs($table['other']), $board, stickyWithText('note', 'Planted'))
        ->assertJsonPath('rejected', []);

    setPrivateWriting($this->actingAs($table['facilitator']), $board, false)->assertNoContent();

    $planted = $board->elements()->where('element_id', 'note-text')->sole();

    expect($planted->is_private)->toBeFalse()
        ->and($planted->author_member_id)->toBe($table['otherMember']->id)
        ->and($planted->data['text'])->toBe('Planted')
        ->and($version->fresh()->private_element_ids)->toBe(['note', 'note-text']);
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

it('refuses to hide the notes while a vote is open', function () {
    $board = Whiteboard::factory()->create();
    [$facilitator] = whiteboardFacilitator($board);
    whiteboardSticky($board, 'note');
    $session = openWhiteboardVote($board);

    setPrivateWriting($this->actingAs($facilitator), $board, true)
        ->assertStatus(422)
        ->assertJsonPath('message', 'Close the vote first.');

    expect($board->fresh()->private_writing)->toBeFalse();

    $session->update(['closed_at' => now(), 'results' => []]);

    setPrivateWriting($this->actingAs($facilitator), $board, true)->assertNoContent();

    expect($board->fresh()->private_writing)->toBeTrue();
});

it('refuses to open a vote while the notes are hidden', function () {
    $table = privateWritingBoard();

    $this->actingAs($table['facilitator'])
        ->postJson(route('whiteboards.voteSessions.store', $table['board']), ['votes_per_member' => 3, 'allow_multiple' => false])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Reveal the notes first.');

    $this->actingAs($table['author'])
        ->postJson(route('whiteboards.voteSessions.store', $table['board']), ['votes_per_member' => 3, 'allow_multiple' => false])
        ->assertForbidden();

    expect(WhiteboardVoteSession::query()->count())->toBe(0);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards/WhiteboardPrivateWritingSwitchTest.php`
Expected: FAIL — the first test finds `private_writing` still false (the key is not validated, so it is ignored); the duplicate test gets 201; the vote is opened although the notes are hidden. The test "keeps a note deleted while hidden out of a version when its id is used again" must also be seen failing for its own reason: once Step 4 is in place, run it once with the `created_at` condition of `revealInVersions()` removed (expected: the list comes back `[]`), then put the condition back. In that test the version is created five minutes after the notes and the planted note two days later; tests that reveal a note written in the same second as the version pass because of the `<=`.

- [ ] **Step 3: The guard**

Add to `app/Actions/Whiteboards/WhiteboardGuard.php`, before `canDelete()` (`ValidationException` is already imported; `openVoteSession()` throws a 422 the same way):

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
use App\Models\WhiteboardVersion;
use Illuminate\Validation\ValidationException;

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

        if (! $on) {
            $this->reveal($locked);

            return;
        }

        if ($locked->voteSessions()->whereNull('closed_at')->exists()) {
            throw ValidationException::withMessages(['private_writing' => __('Close the vote first.')]);
        }

        $locked->update(['private_writing' => true]);
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

        $hidden = $locked->elements()->where('is_private', true)->where('is_deleted', false);
        $revealedIds = $hidden->clone()->pluck('element_id');

        if ($revealedIds->isEmpty()) {
            $locked->update(['private_writing' => false]);

            return;
        }

        $hidden->update(['is_private' => false, 'seq' => $seq]);

        $this->revealInVersions($locked, $revealedIds->all());

        $locked->update(['private_writing' => false, 'seq' => $seq]);

        (new WhiteboardElementsChanged($locked->id, $seq, $fromSeq, null))->sendToOthers();
    }

    /**
     * A version stored while the notes were hidden may now show them; what
     * stays on its list was deleted before the reveal and is never shown.
     * The list holds ids, and an id is free again once its tombstone is
     * purged: only a row that is not younger than the version is the
     * element the version stored.
     *
     * @param  list<string>  $revealedIds
     */
    private function revealInVersions(Whiteboard $locked, array $revealedIds): void
    {
        $locked->versions()
            ->whereJsonLength('private_element_ids', '>', 0)
            ->get(['id', 'private_element_ids', 'created_at'])
            ->each(function (WhiteboardVersion $version) use ($locked, $revealedIds): void {
                $listed = array_values(array_intersect($version->private_element_ids, $revealedIds));

                if ($listed === []) {
                    return;
                }

                $shown = $locked->elements()
                    ->whereIn('element_id', $listed)
                    ->where('created_at', '<=', $version->created_at)
                    ->pluck('element_id')
                    ->all();

                $version->update([
                    'private_element_ids' => array_values(array_diff($version->private_element_ids, $shown)),
                ]);
            });
    }
}
```

One query per version that lists a revealed id (at most 50 automatic versions and 100 named ones, and only those stored during a private round). `$hidden->clone()->pluck('element_id')` is read before the update that clears the flag; `revealInVersions()` runs after it and finds the rows by id. An element row's `created_at` is set once, when the write path first creates the row, and no code path changes it: an update keeps it, and restore gives an element whose row is gone a fresh id (Task 6). (`->all()` on the plucked collection gives `array<int, string>`; if PHPStan asks for a list, wrap it in `array_values()`.)

- [ ] **Step 5: The settings key**

In `app/Http/Controllers/Whiteboards/WhiteboardSettingsController.php` (plan 17c's `locked` and `follow_enabled` keys stay): inject the action, validate the key, take it out of the mass update and apply it inside the lock, before `board.changed`. The whole method:

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
            'locked' => ['sometimes', 'boolean'],
            'follow_enabled' => ['sometimes', 'boolean'],
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

In `app/Actions/Whiteboards/SaveWhiteboardTemplate.php`, right after its `$locked = …lockForUpdate()->firstOrFail();` line (before the workspace lock), with a blank line on each side:

```php
            WhiteboardGuard::notPrivateWriting($locked);
```

The check sits inside the board lock: a facilitator switching private writing on waits for the copy, or the copy sees the switch. Neither path reads `is_private`: once the notes are revealed no live row carries it, and `ReadWhiteboardScene` reads live rows only.

- [ ] **Step 7: Private writing and voting exclude each other**

Spec §11.4 and §11.5. Plan 17c left both halves to this plan (its `OpenWhiteboardVote` has no check, and there was no switch to refuse).

Turning private writing on while a vote is open is refused inside `SetWhiteboardPrivateWriting::handle()` (already in the file of Step 4): 422 "Close the vote first." — the key plan 17c added for dismissing an open vote, reused as it is.

Opening a vote while the notes are hidden: in `app/Actions/Whiteboards/OpenWhiteboardVote.php`, inside the board lock, right after `WhiteboardGuard::facilitator($locked, $member);`:

```php
            WhiteboardGuard::notPrivateWriting($locked);
```

A member who is not the facilitator still gets 403 first. Both rules are pinned by the last two tests of Step 1, which use plan 17c's helpers `whiteboardSticky()` and `openWhiteboardVote()`.

The two cannot overlap afterwards either: no live private row exists while a vote is open (the reveal clears them all, and a private tombstone brought back with the switch off becomes ordinary), so the text a closing vote copies into its results (`CloseWhiteboardVote::label`) is never a hidden one.

- [ ] **Step 8: Translations**

| Key (English) | French | German | Spanish |
|---|---|---|---|
| Reveal the notes first. | Révélez d'abord les post-it. | Decken Sie zuerst die Haftnotizen auf. | Revela primero las notas. |

Add the key to `lang/en.json` (value = key) and the three others; `lang/*.json` are not sorted: append. "Close the vote first." exists in the four files.

- [ ] **Step 9: Run, gates, commit**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards tests/Feature/TranslationKeysTest.php`
Expected: PASS.

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/phpstan analyse --memory-limit=1G app/Actions/Whiteboards/SetWhiteboardPrivateWriting.php app/Actions/Whiteboards/WhiteboardGuard.php app/Http/Controllers/Whiteboards/WhiteboardSettingsController.php app/Actions/Whiteboards/DuplicateWhiteboard.php app/Actions/Whiteboards/SaveWhiteboardTemplate.php app/Actions/Whiteboards/OpenWhiteboardVote.php
git add app/Actions/Whiteboards/SetWhiteboardPrivateWriting.php app/Actions/Whiteboards/WhiteboardGuard.php app/Http/Controllers/Whiteboards/WhiteboardSettingsController.php app/Actions/Whiteboards/DuplicateWhiteboard.php app/Actions/Whiteboards/SaveWhiteboardTemplate.php app/Actions/Whiteboards/OpenWhiteboardVote.php lang/en.json lang/fr.json lang/de.json lang/es.json tests/Feature/Whiteboards/WhiteboardPrivateWritingSwitchTest.php
git commit -m "feat(whiteboard): the private writing switch, the reveal and the actions it blocks"
```

---
### Task 4: Automatic versions

**Files:**
- Create: `app/Actions/Whiteboards/StoreWhiteboardVersion.php`, `app/Actions/Whiteboards/ScheduleWhiteboardVersion.php`, `app/Actions/Whiteboards/QueueMissedWhiteboardVersions.php`, `app/Jobs/StoreAutomaticWhiteboardVersion.php`
- Modify: `app/Actions/Whiteboards/WriteWhiteboardElements.php`, `app/Actions/Whiteboards/SetWhiteboardPrivateWriting.php`, `app/Actions/Whiteboards/PruneWhiteboardFiles.php`, `app/Console/Commands/PruneWhiteboardsCommand.php`
- Test: `tests/Feature/Whiteboards/WhiteboardAutomaticVersionsTest.php`

**Interfaces:**
- Consumes: `ReadWhiteboardScene::handle(Whiteboard $board): array{elements: list<array>, files: list<SceneFile>}` (live elements in canvas order, real text); `KeepWhiteboardTextOutOfLogs::handle(string, Closure): mixed` (Task 2); `WhiteboardVersion`, `Whiteboard::versions()`, `Whiteboard::$last_versioned_seq` (Task 1); `WriteWhiteboardElements`, `SetWhiteboardPrivateWriting` (Tasks 2–3); the job idiom of `app/Jobs/RevealPokerRoundOnTimer.php` and its dispatch in `app/Http/Controllers/Poker/PokerTimersController.php` (`::dispatch(...)->delay(...)->afterCommit()`).
- Produces:
  - `StoreWhiteboardVersion::handle(Whiteboard $locked, ?WhiteboardMember $member, ?string $name): WhiteboardVersion` — the caller holds the lock on the board row. Stores the live scene as `{elements, fileIds}` and, in `private_element_ids`, the ids of the live rows that are private at that moment; sets `last_versioned_seq = seq` without moving `updated_at`, and, for an automatic version (`$name === null`), deletes the automatic versions beyond the 50 most recent. It does **not** check the cap of named versions (Task 5 does, Task 6 must not).
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
        ->and($version->private_element_ids)->toBe(['note', 'note-text'])
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
            'private_element_ids' => $this->privateElementIds($locked),
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
        return array_values(collect($elements)
            ->where('type', 'image')
            ->pluck('fileId')
            ->filter(fn (mixed $fileId): bool => is_string($fileId))
            ->unique()
            ->all());
    }

    /**
     * @return list<string>
     */
    private function privateElementIds(Whiteboard $locked): array
    {
        return array_values($locked->elements()
            ->where('is_private', true)
            ->where('is_deleted', false)
            ->orderBy('element_id')
            ->pluck('element_id')
            ->all());
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

In `app/Console/Commands/PruneWhiteboardsCommand.php`: change `$description` to `'Remove expired whiteboard tombstones and unused images, and queue missed versions'`, add `QueueMissedWhiteboardVersions $queueMissedWhiteboardVersions` as the third parameter of `handle()` (one parameter per line, `): int {` on the closing line, which is how Pint formats it) and, before `return self::SUCCESS;`:

```php
        $this->info('Queuing missed versions...');

        $versions = $queueMissedWhiteboardVersions->handle();

        $this->comment("Queued {$versions} versions.");
```

- [ ] **Step 5: Schedule from every change of `seq`**

In `app/Actions/Whiteboards/WriteWhiteboardElements.php`: add `private ScheduleWhiteboardVersion $scheduleWhiteboardVersion,` to the constructor (after `KeepWhiteboardTextOutOfLogs`) and, right after `$locked->update(['seq' => $seq]);`, before the broadcasts:

```php
            $this->scheduleWhiteboardVersion->handle($locked, $fromSeq);
```

(That line is only reached when `seq` moved: the early return for an unchanged `seq` is above it.)

In `app/Actions/Whiteboards/SetWhiteboardPrivateWriting.php`: add a constructor `public function __construct(private ScheduleWhiteboardVersion $scheduleWhiteboardVersion) {}` as the first member of the class and, in `reveal()`, after `$locked->update(['private_writing' => false, 'seq' => $seq]);` (blank line on each side):

```php
        $this->scheduleWhiteboardVersion->handle($locked, $fromSeq);
```

- [ ] **Step 6: A version keeps its images**

In `app/Actions/Whiteboards/PruneWhiteboardFiles.php` replace `isUsed()` and its docblock:

```php
    /**
     * A file lives while a live element or a version of its board shows it
     * (spec §6.5). A template keeps its own copy of every image (spec §10).
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
Expected: PASS. From now on every test that writes to a board whose `seq` equals `last_versioned_seq` runs the job at once (the test queue is synchronous) and stores one version; no test of plans 17a–17c counts versions or pushed jobs (the complete suite passed on the prototype), and `privateWritingBoard()` never triggers it (`seq` 2, `last_versioned_seq` 0).

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
- Create: `app/Actions/Whiteboards/PresentWhiteboardVersion.php`, `app/Actions/Whiteboards/ReadWhiteboardVersion.php`, `app/Http/Controllers/Whiteboards/WhiteboardVersionsController.php`
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
  - `ReadWhiteboardVersion::handle(WhiteboardVersion $version): list<array<string, mixed>>` — the elements of a version without those listed in `private_element_ids`. The only way a scene leaves a version: Task 6 uses it for restore and copy.

**Rules** (spec §9):
- A guest gets 403 "Guests cannot do this." on every endpoint, before any other answer.
- List and preview answer 422 "Reveal the notes first." while private writing is on. Saving, renaming and deleting stay allowed: they return no content of a scene.
- Save: `name` required, 1–80 characters (trimmed by the framework). At most 100 named versions per board: 422 "This board already has 100 saved versions.". Saving sets `last_versioned_seq`.
- Rename: `name` 1–80. Naming an automatic version makes it a named one: it leaves the rotation of the 50 automatic versions and counts in the 100, so the cap is checked. Delete: any version.
- Preview returns what `ReadWhiteboardVersion` gives (the stored elements, minus the notes that were deleted before the reveal) and, in `files`, the images of the version that the board still stores.
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

it('never previews a note that was deleted before the reveal', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    [$note, $text] = stickyWithText('note', 'Revealed idea');
    [$dropped, $droppedText] = stickyWithText('dropped', 'Dropped thought 5522');
    $version = WhiteboardVersion::factory()->create([
        'whiteboard_id' => $board->id,
        'scene' => ['elements' => [$note, $text, $dropped, $droppedText], 'fileIds' => []],
        'private_element_ids' => ['dropped', 'dropped-text'],
    ]);

    $preview = $this->actingAs($user)
        ->getJson(route('whiteboards.versions.show', [$board, $version]))
        ->assertOk()
        ->assertJsonPath('elements.*.id', ['note', 'note-text'])
        ->assertJsonPath('elements.1.text', 'Revealed idea');

    expect(whiteboardPayloadExposes($preview->getContent(), 'Dropped thought'))->toBeFalse();
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

- [ ] **Step 3: Presenter and reader**

`app/Actions/Whiteboards/ReadWhiteboardVersion.php`:

```php
<?php

namespace App\Actions\Whiteboards;

use App\Models\WhiteboardVersion;

/**
 * The elements a version may show: all of them but those that were private
 * when it was stored and that no reveal has shown since (spec §9). They
 * carry real text, so every caller checks `notPrivateWriting` first.
 */
class ReadWhiteboardVersion
{
    /**
     * @return list<array<string, mixed>>
     */
    public function handle(WhiteboardVersion $version): array
    {
        $neverRevealed = array_flip($version->private_element_ids);

        return array_values(array_filter(
            $version->scene['elements'],
            fn (array $element): bool => ! isset($neverRevealed[$element['id']]),
        ));
    }
}
```

A note left out may leave a dangling `boundElements` entry on a shape that stays; the sanitizer and the canvas both accept that (the canvas treats a missing bound text as none).

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
use App\Actions\Whiteboards\ReadWhiteboardVersion;
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

    public function show(Request $request, Whiteboard $board, WhiteboardVersion $version, ReadWhiteboardVersion $readWhiteboardVersion): JsonResponse
    {
        WhiteboardGuard::notGuest(WhiteboardMember::current($request));
        WhiteboardGuard::notPrivateWriting($board);

        return response()->json([
            'elements' => $readWhiteboardVersion->handle($version),
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

In `routes/web.php` import `App\Http\Controllers\Whiteboards\WhiteboardVersionsController` and add, at the end of the `whiteboards/{board}` group (after the `duplicate` route):

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

"Guests cannot do this." exists; "Reveal the notes first." was added in Task 3.

- [ ] **Step 7: Run, gates, commit**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards tests/Feature/TranslationKeysTest.php`
Expected: PASS.

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/phpstan analyse --memory-limit=1G app/Actions/Whiteboards/PresentWhiteboardVersion.php app/Actions/Whiteboards/ReadWhiteboardVersion.php app/Http/Controllers/Whiteboards/WhiteboardVersionsController.php
git add app/Actions/Whiteboards/PresentWhiteboardVersion.php app/Actions/Whiteboards/ReadWhiteboardVersion.php app/Http/Controllers/Whiteboards/WhiteboardVersionsController.php routes/web.php lang/en.json lang/fr.json lang/de.json lang/es.json tests/Feature/Whiteboards/WhiteboardVersionsTest.php
git commit -m "feat(whiteboard): list, save, preview, rename and delete versions"
```

---
### Task 6: Restore a version, copy a version to a new board

**Files:**
- Create: `app/Actions/Whiteboards/RestoreWhiteboardVersion.php`, `app/Actions/Whiteboards/CopyWhiteboardVersion.php`, `app/Http/Controllers/Whiteboards/WhiteboardVersionRestoresController.php`, `app/Http/Controllers/Whiteboards/WhiteboardVersionCopiesController.php`
- Modify: `app/Actions/Whiteboards/DuplicateWhiteboard.php` (`title()` becomes public), `routes/web.php`, `lang/{en,fr,de,es}.json`
- Test: `tests/Feature/Whiteboards/WhiteboardVersionRestoreTest.php`

**Interfaces:**
- Consumes: `StoreWhiteboardVersion::handle(Whiteboard $locked, ?WhiteboardMember $member, ?string $name): WhiteboardVersion`, `ScheduleWhiteboardVersion::handle(Whiteboard $locked, int $fromSeq): void` (Task 4); `ReadWhiteboardVersion::handle(WhiteboardVersion): list<array>` (Task 5); `Whiteboard::voteSessions()`, `WhiteboardVoteSession::votes()`, the test helpers `whiteboardSticky()`, `openWhiteboardVote()`, `castWhiteboardVote()` and the factory state `WhiteboardVoteSession::factory()->closed(array $results)` (plan 17c); `KeepWhiteboardTextOutOfLogs::handle` (Task 2); `WhiteboardGuard::notGuest`, `::facilitator`, `::notPrivateWriting`; `SanitizeWhiteboardElement::handle(mixed): ?array`, `SanitizeWhiteboardElement::MaxVersion`; `CreateWhiteboard::handle(Team $team, User $creator, string $title, array $scene): Whiteboard` (scene = `{elements, files: list<{fileId, path, mimeType, size}>}`); `DuplicateWhiteboard::title(string): string`; events `WhiteboardElementsChanged`, `WhiteboardChanged`.
- Produces:
  - `POST whiteboards/{board}/versions/{version}/restore` → `whiteboards.versions.restore.store`, facilitator, 204; `elements.changed` (ids-only) when something changed, then `board.changed`.
  - `POST whiteboards/{board}/versions/{version}/copy` → `whiteboards.versions.copy.store`, non-guest member, 201 `{url}` (relative URL of the new board).
  - `RestoreWhiteboardVersion::handle(Whiteboard $board, WhiteboardMember $member, WhiteboardVersion $version): void`
  - `CopyWhiteboardVersion::handle(Whiteboard $board, User $user, WhiteboardVersion $version): Whiteboard`

**Restore, precisely** (spec §9; one transaction, board row locked, facilitator and `notPrivateWriting` re-checked inside):

1. Store the current scene as a named version "Before restore · {date}" (`StoreWhiteboardVersion`, created by the facilitator). It is not counted against the cap of 100 when it is stored: a restore is never refused because the history is full.
2. Take the elements the chosen version may show (`ReadWhiteboardVersion`), in their stored order, through `SanitizeWhiteboardElement`; leave out what it refuses and any image whose file the board no longer stores.
3. An element whose row no longer exists (its tombstone was purged), or whose row is a tombstone already at the highest version number, comes back under a **fresh id**, version 1, and every reference to it inside the restored elements is rewritten (`containerId`, `frameId`, `boundElements[].id`, `startBinding/endBinding.elementId`). Reason: a browser left open for days may still hold the old tombstone at a version the server no longer knows; under the old id the canvas would keep its tombstone (`reconcileElements` keeps the higher version) and write the deletion back.
4. Every other element is written over its row with `version = max(stored, version's) + 1` (at most the highest version number), a new nonce, `isDeleted = false`, `is_private = false`, and the next `seq`. An element whose row is live, carries the same `version` and `versionNonce` as in the version and needs no reference rewritten is left alone: nothing changed since.
5. Every live row that is not part of the restored set becomes a tombstone: `isDeleted = true`, `version + 1`, new nonce, next `seq`.
6. A live row at the highest version number can be neither rewritten nor tombstoned: it is left as it is (a client put it there; the rest of the board is restored).
7. An open voting session is closed without results (`results = []`, its votes deleted, as `CloseWhiteboardVote` deletes them) and every closed, undismissed session is dismissed, the one just closed included.
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
use App\Models\WhiteboardVoteSession;
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

it('never restores or copies a note that was deleted before the reveal', function () {
    $board = Whiteboard::factory()->create(['title' => 'Retro']);
    [$facilitator] = whiteboardFacilitator($board);
    [$note, $text] = stickyWithText('note', 'Revealed idea');
    [$dropped, $droppedText] = stickyWithText('dropped', 'Dropped thought 5522');
    $version = WhiteboardVersion::factory()->create([
        'whiteboard_id' => $board->id,
        'scene' => ['elements' => [$note, $text, $dropped, $droppedText], 'fileIds' => []],
        'private_element_ids' => ['dropped', 'dropped-text'],
    ]);

    $this->actingAs($facilitator)->postJson(route('whiteboards.versions.copy.store', [$board, $version]))->assertCreated();
    restoreVersion($this->actingAs($facilitator), $board, $version)->assertNoContent();

    $stored = WhiteboardElement::query()->get()->map(fn (WhiteboardElement $element): array => $element->data)->all();
    $snapshot = $this->actingAs($facilitator)->getJson(route('whiteboards.snapshot.show', $board))->assertOk();

    expect(WhiteboardElement::query()->count())->toBe(4)
        ->and(whiteboardPayloadExposes($stored, 'Revealed idea'))->toBeTrue()
        ->and(whiteboardPayloadExposes($stored, 'Dropped thought'))->toBeFalse()
        ->and(whiteboardPayloadExposes($snapshot->getContent(), 'Dropped thought'))->toBeFalse();
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

it('closes an open vote without results and dismisses a closed one when a version is restored', function () {
    [$board, $facilitator, $version] = boardWithHistory();
    [, $voter] = whiteboardMember($board);
    whiteboardSticky($board, 'voted');
    $results = [['elementId' => 'voted', 'text' => 'Counted', 'count' => 2]];
    $closed = WhiteboardVoteSession::factory()->closed($results)->create(['whiteboard_id' => $board->id, 'closed_at' => now()->subHour()]);
    $open = openWhiteboardVote($board);
    castWhiteboardVote($open, $voter, 'voted');

    restoreVersion($this->actingAs($facilitator), $board, $version)->assertNoContent();

    expect($open->fresh()->closed_at)->not->toBeNull()
        ->and($open->fresh()->results)->toBe([])
        ->and($open->fresh()->dismissed_at)->not->toBeNull()
        ->and($open->votes()->count())->toBe(0)
        ->and($closed->fresh()->dismissed_at)->not->toBeNull()
        ->and($closed->fresh()->results)->toBe($results);

    $this->actingAs($facilitator)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertOk()
        ->assertJsonPath('voting', null)
        ->assertJsonPath('votingHistory.*.id', [$closed->id]);
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
        private ReadWhiteboardVersion $readWhiteboardVersion,
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

            $this->endVoting($locked);

            if ($seq !== $fromSeq) {
                $locked->update(['seq' => $seq]);

                (new WhiteboardElementsChanged($locked->id, $seq, $fromSeq, null))->sendToOthers();

                $this->scheduleWhiteboardVersion->handle($locked, $fromSeq);
            }

            (new WhiteboardChanged($locked->id))->sendToOthers();
        }));
    }

    /**
     * The notes a vote counted may be gone or changed (spec §9): an open
     * session ends without results, and no closed session keeps its badges.
     */
    private function endVoting(Whiteboard $locked): void
    {
        $open = $locked->voteSessions()->whereNull('closed_at')->first();

        $open?->votes()->delete();
        $open?->update(['results' => [], 'closed_at' => now()]);

        $locked->voteSessions()->whereNull('dismissed_at')->update(['dismissed_at' => now()]);
    }

    private function safetyName(): string
    {
        return __('Before restore · :date', ['date' => now()->settings(['locale' => app()->getLocale()])->isoFormat('LL LT')]);
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

        foreach ($this->readWhiteboardVersion->handle($chosen) as $raw) {
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
- `safetyName()` uses `->settings(['locale' => …])`, the idiom of `ActionItemReminderDigestNotification`: `now()->locale(…)` returns `static|string` for PHPStan.
- `endVoting()` updates the open session through the model so that the `results` cast writes `[]`; the mass update of `dismissed_at` needs no cast. `PresentWhiteboardVoting::history()` leaves out a session without results, so the vote ended by a restore never shows in the results panel.
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
        private ReadWhiteboardVersion $readWhiteboardVersion,
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
                'elements' => $this->readWhiteboardVersion->handle($chosen),
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

":title (copy)" (plan 17b) and "Only the facilitator can do this." exist.

- [ ] **Step 6: Check the vote and the lock against plan 17c**

Nothing to write: `endVoting()` is in the action of Step 3 and its test ("closes an open vote without results and dismisses a closed one when a version is restored") in the file of Step 1. Confirm by reading that `board.changed`, sent at the end of the restore, is what makes every client drop its voting UI (`use-whiteboard.ts` refetches the snapshot on it; the snapshot then has `voting: null`), and that restore is not stopped by the board lock: `WhiteboardGuard::notLocked` is only called by the element and file writes, and restore is facilitator-only.

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

Built and type-checked on the prototype, never opened in a browser. Names checked: `ExcalidrawImperativeAPI.onChange(callback): UnsubscribeCallback`, `.onScrollChange(callback)`, `.getSceneElements()` (non-deleted elements), `.getAppState()` (`node_modules/@excalidraw/excalidraw/dist/types/excalidraw/types.d.ts`, lines 604–634); the layer rule plan 17c wrote down in `vote-overlay.tsx` (a sibling of the canvas with `z-[3]` sits above the drawing, canvases at 1–2, and below the canvas's interface at 4); `closeTextEditor()` (`resources/js/lib/whiteboard/excalidraw.ts`).

**Files:**
- Create: `resources/js/components/whiteboard/masked-notes.tsx`
- Modify: `resources/js/lib/whiteboard/types.ts`, `resources/js/lib/whiteboard/scene-sync.ts`, `resources/js/hooks/use-whiteboard-overlay.ts`, `resources/js/components/whiteboard/board.tsx`, `resources/js/components/whiteboard/facilitator-bar.tsx`, `resources/js/components/whiteboard/board-menu.tsx`, `lang/{en,fr,de,es}.json`

**Interfaces:**
- Consumes: snapshot `board.privateWriting` (Task 1); rejection reason `private` and the masked wire shape (Task 2); `PATCH settings {private_writing}` (Task 3) through Wayfinder `WhiteboardSettingsController.update(boardId)`; `FacilitatorBar`'s own `updateSettings(settings: Record<string, boolean>)`; `useCanvasView(api): CanvasView | null`, `NoteBox` (`use-whiteboard-overlay.ts`); `<StatusBar>`; `SceneSync.resync()`.
- Produces: `WhiteboardSnapshot['board']['privateWriting']: boolean`; `RejectReason` includes `'private'`; `useMaskedNoteBoxes(api: ExcalidrawImperativeAPI | null): MaskedNoteBox[]` with `MaskedNoteBox = NoteBox & { angle: number }`; `<MaskedNotes api={api} />`. Task 8 reads `privateWriting` in `board.tsx` to disable the history button.

No change to `restore.ts`, and one small change to `scene-sync.ts` (Step 5): `onRejected` also receives the id of the refused element, so that the board closes the text editor only when the refusal is about what is being typed. See "Wire shape of a private note" at the top of this plan for why a masked note is neither deleted on the server nor written back, and for the one write of a masked copy the canvas makes on its own (the index repair, which the server accepts: Task 2, rule 5).

- [ ] **Step 1: Types** — in `resources/js/lib/whiteboard/types.ts` add `privateWriting: boolean;` to `WhiteboardSnapshot['board']` (after `followEnabled`) and `| 'private'` to `RejectReason` (after `'voting'`).

- [ ] **Step 2: Where the masked notes are** — in `resources/js/hooks/use-whiteboard-overlay.ts`, add two optional keys to the file's `CanvasElement` type:

```ts
    angle?: number;
    isDeleted: boolean;
    customData?: Record<string, unknown>;
    boundElements?: readonly { id: string; type: string }[] | null;
```

and append to the file:

```ts
export type MaskedNoteBox = NoteBox & { angle: number };

const isMasked = (element: CanvasElement) =>
    (element.customData?.skrum as { masked?: unknown } | undefined)?.masked ===
    true;

/**
 * The notes whose text this viewer was not given (spec §11.5), in scene
 * coordinates. A masked note someone copied and typed into has a live text
 * of its own and is left out.
 */
export function useMaskedNoteBoxes(
    api: ExcalidrawImperativeAPI | null,
): MaskedNoteBox[] {
    const [boxes, setBoxes] = useState<MaskedNoteBox[]>([]);

    useEffect(() => {
        if (!api) {
            setBoxes([]);

            return;
        }

        let signature = '';

        const read = (elements: readonly CanvasElement[]) => {
            const live = new Set(
                elements
                    .filter((element) => !element.isDeleted)
                    .map((element) => element.id),
            );
            const next = elements
                .filter(
                    (element) =>
                        !element.isDeleted &&
                        isMasked(element) &&
                        !(element.boundElements ?? []).some(
                            (bound) =>
                                bound.type === 'text' && live.has(bound.id),
                        ),
                )
                .map(({ id, x, y, width, height, angle }) => ({
                    id,
                    x,
                    y,
                    width,
                    height,
                    angle: angle ?? 0,
                }));
            const nextSignature = next
                .map((box) => Object.values(box).join(':'))
                .join('|');

            // onChange also fires on every selection and pointer state.
            if (nextSignature === signature) {
                return;
            }

            signature = nextSignature;
            setBoxes(next);
        };

        read(api.getSceneElements());

        return api.onChange((elements) => read(elements));
    }, [api]);

    return boxes;
}
```

It is the shape of `useNoteBoxes` just above it, without a list of ids: the marker on the element decides. A masked note's bound text is deleted locally, so the note has no live text and gets its mark; once revealed, the server copy has no `masked` marker and the mark goes. Known limit, accepted: a member who duplicates a masked note gets an empty note of their own that shows the mark until they type in it (the marker is copied by the canvas and dropped by the server on write).

- [ ] **Step 3: The marks** — `resources/js/components/whiteboard/masked-notes.tsx`:

```tsx
import { useTrans } from '@/hooks/use-trans';
import {
    useCanvasView,
    useMaskedNoteBoxes,
} from '@/hooks/use-whiteboard-overlay';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';

/**
 * "•••" on every note whose text the server kept from this viewer (spec
 * §11.5). Same layer as the vote badges: above the drawing, under the
 * canvas's own controls, and never in the way of a click.
 */
export function MaskedNotes({ api }: { api: ExcalidrawImperativeAPI }) {
    const { t } = useTrans();
    const view = useCanvasView(api);
    const boxes = useMaskedNoteBoxes(api);

    if (!view) {
        return null;
    }

    return (
        <div className="pointer-events-none absolute inset-0 z-[3] overflow-hidden">
            {boxes.map((box) => (
                <span
                    key={box.id}
                    role="img"
                    aria-label={t('Hidden note')}
                    className="absolute flex items-center justify-center text-foreground/60 select-none"
                    style={{
                        left: (box.x + view.scrollX) * view.zoom,
                        top: (box.y + view.scrollY) * view.zoom,
                        width: box.width * view.zoom,
                        height: box.height * view.zoom,
                        fontSize: Math.max(12, 28 * view.zoom),
                        transform: `rotate(${box.angle}rad)`,
                    }}
                >
                    •••
                </span>
            ))}
        </div>
    );
}
```

In `board.tsx`, inside the `<div ref={canvas} …>` that holds `<Excalidraw>`, right before `{api && voting && (<VoteOverlay …`:

```tsx
                        {api && privateWriting && <MaskedNotes api={api} />}
```

(`privateWriting` is the constant of Step 5.) The mark is centred on the note and turns with it (`transform-origin` is the centre, which is what the canvas rotates around).

- [ ] **Step 4: The button** — in `facilitator-bar.tsx`, import `Eye` and `EyeOff` from `lucide-react`, update the component's comment to "Timer, board lock, follow-me, private writing and vote: the facilitator's tools.", and add between the follow-me button and the vote button:

```tsx
            <Button
                size="sm"
                variant={board.privateWriting ? 'default' : 'outline'}
                aria-pressed={board.privateWriting}
                aria-label={t(
                    board.privateWriting
                        ? 'Reveal the notes'
                        : 'Private writing',
                )}
                title={t(
                    board.privateWriting
                        ? 'Reveal the notes'
                        : 'Private writing',
                )}
                onClick={() =>
                    void updateSettings({
                        private_writing: !board.privateWriting,
                    })
                }
            >
                {board.privateWriting ? (
                    <>
                        <Eye className="size-4" />
                        {t('Reveal the notes')}
                    </>
                ) : (
                    <EyeOff className="size-4" />
                )}
            </Button>
```

`updateSettings` already shows the server's refusal in a toast ("Close the vote first.") and refetches the snapshot on success. One switch only: nothing is added to the board menu for the facilitator. On the "Start a vote" button of the same file, the `title` and `disabled` props become:

```tsx
                    title={t(
                        board.privateWriting
                            ? 'Reveal the notes first.'
                            : 'Start a vote',
                    )}
                    disabled={api === null || board.privateWriting}
```

In `board-menu.tsx`, the "Duplicate this board" and "Save as template" items get `disabled={board.privateWriting}` (the server answers 422 "Reveal the notes first." anyway).

- [ ] **Step 5: `board.tsx`** —

  - import `EyeOff` from `lucide-react` (beside `Lock`) and `{ MaskedNotes } from './masked-notes'`;
  - add `private: ''` to the initial `rejectionMessages` record and `private: t('Only its author can change a hidden note.')` to the assignment below it;
  - in `resources/js/lib/whiteboard/scene-sync.ts`, `onRejected` says which element was refused. The type in `SceneSyncDeps` becomes

```ts
    /** `elementId` is null when the server could not read an id. */
    onRejected: (reason: RejectReason, elementId: string | null) => void;
```

    and its two callers pass the id: in `settle()`, `deps.onRejected(rejection.reason, rejection.id);`; in `withUploadedFiles()`, `deps.onRejected('file', element.id);`. Nothing else in the file changes.

  - `onRejected` of `createSceneSync` in `board.tsx` becomes:

```tsx
            onRejected: (reason, elementId) => {
                const editing = api.getAppState().editingTextElement;

                // Typing into someone's hidden note: the editor would keep
                // writing a text the server refuses at every key. A refusal
                // about any other element leaves the editor alone: the
                // member may be typing their own note.
                if (
                    reason === 'private' &&
                    editing &&
                    elementId !== null &&
                    (editing.id === elementId ||
                        editing.containerId === elementId)
                ) {
                    queueMicrotask(closeTextEditor);
                }

                toast.error(rejectionMessages.current[reason], { id: reason });
            },
```

    `api` is the non-null canvas API of the effect that creates the sync (the effect returns early when it is null). Typing into a masked note creates a new bound text (the masked one is deleted locally) and rewrites the note's list: both are refused, the first with the id of the text being edited, the second with the id of its container — either closes the editor. `editingTextElement` is a text element, so it has `containerId` (`node_modules/@excalidraw/excalidraw/dist/types/excalidraw/types.d.ts`, `AppState.editingTextElement`); this snippet was written after the prototype and has not been type-checked.

  - after the polling effect:

```tsx
    const privateWriting = board.privateWriting;

    // The reveal reaches the other tabs as an `elements.changed` without
    // elements; the tab that asked for it, and a tab that missed the event,
    // learn it from the snapshot and fetch the notes here.
    useEffect(() => {
        void sync.current?.resync();
    }, [privateWriting]);
```

  - in `<StatusBar>`, after the "This board is locked." item:

```tsx
                    {privateWriting && (
                        <span className="flex flex-wrap items-center gap-x-2">
                            <EyeOff className="size-4" aria-hidden="true" />
                            {t(
                                'Notes are hidden until the facilitator reveals them. Other elements stay visible.',
                            )}
                            <span className="text-xs text-muted-foreground">
                                {t(
                                    'The size of a note hints at the length of its text.',
                                )}
                            </span>
                        </span>
                    )}
```

The status row is a row of the page's flex column, between the top bar and the canvas: it covers nothing. Everyone sees the sentence, the facilitator included.

- [ ] **Step 6: Translations**

| Key (English) | French | German | Spanish |
|---|---|---|---|
| Private writing | Écriture privée | Privates Schreiben | Escritura privada |
| Reveal the notes | Révéler les post-it | Haftnotizen aufdecken | Revelar las notas |
| Notes are hidden until the facilitator reveals them. Other elements stay visible. | Les post-it sont masqués jusqu'à ce que l'animateur les révèle. Les autres éléments restent visibles. | Haftnotizen bleiben verborgen, bis der Moderator sie aufdeckt. Andere Elemente bleiben sichtbar. | Las notas quedan ocultas hasta que el facilitador las revele. Los demás elementos siguen visibles. |
| The size of a note hints at the length of its text. | La taille d'un post-it laisse deviner la longueur de son texte. | Die Größe einer Haftnotiz lässt die Länge ihres Textes erahnen. | El tamaño de una nota deja intuir la longitud de su texto. |
| Hidden note | Post-it masqué | Verborgene Haftnotiz | Nota oculta |
| Only its author can change a hidden note. | Seul son auteur peut modifier un post-it masqué. | Nur der Autor kann eine verborgene Haftnotiz ändern. | Solo su autor puede modificar una nota oculta. |

"Reveal the notes first." (Task 3), "Close the vote first." and "Something went wrong. Please try again." exist.

- [ ] **Step 7: Gates and commit**

Run: `npm run build && npm run types:check && npx vp check resources/js/lib/whiteboard/types.ts resources/js/lib/whiteboard/scene-sync.ts resources/js/hooks/use-whiteboard-overlay.ts resources/js/components/whiteboard/board.tsx resources/js/components/whiteboard/board-menu.tsx resources/js/components/whiteboard/facilitator-bar.tsx resources/js/components/whiteboard/masked-notes.tsx && DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: no error in these files (run `npx vp check --fix <file>` for a formatting remark); test PASS.

```bash
git add resources/js/lib/whiteboard/types.ts resources/js/lib/whiteboard/scene-sync.ts resources/js/hooks/use-whiteboard-overlay.ts resources/js/components/whiteboard/board.tsx resources/js/components/whiteboard/board-menu.tsx resources/js/components/whiteboard/facilitator-bar.tsx resources/js/components/whiteboard/masked-notes.tsx lang/en.json lang/fr.json lang/de.json lang/es.json
git commit -m "feat(whiteboard): private writing button, status sentence and masked note marks on the board"
```

**Browser checks (for the walkthrough):**
- B7.1 Facilitator A: the facilitator bar has an eye button titled "Private writing"; a member and a guest have no facilitator bar. Clicking it shows, in the status row of every browser and without a reload, "Notes are hidden until the facilitator reveals them. Other elements stay visible." and the size hint; A's button now reads "Reveal the notes".
- B7.2 Member B (127.0.0.1) adds a sticky note and types "Secret idea": B sees the text; A and a guest see an empty note of the same colour at the same place with "•••" centred on it. In A's browser, `fetch` of `GET snapshot` and `GET elements?since=0` (XSRF header) returns no "Secret idea".
- B7.3 A pans and zooms: every "•••" stays on its note; a note scrolled under the shapes toolbar, the zoom controls or the reactions bar has its mark behind them, never over them; the marks never block a click on the canvas; a rotated note has its mark rotated with it.
- B7.4 A drags B's masked note, erases it, and double-clicks it to type: each time the canvas returns to the masked note within about a second, a toast says "Only its author can change a hidden note.", the text editor closes, and B's browser still shows "Secret idea" in place.
- B7.5 A note that existed before the switch keeps its text for everyone; typing into it while the switch is on shows for everyone. A plain text and a rectangle with a label added while the switch is on are visible to everyone.
- B7.6 B opens the board in a second tab: the note shows its text there too.
- B7.7 A clicks "Reveal the notes": within about a second every browser, A's included, shows "Secret idea" without a reload, the marks and the status sentence disappear. B deleted a second hidden note before the reveal: it does not appear.
- B7.8 While the switch is on: "Duplicate this board" and "Save as template" are disabled; calling `POST duplicate` from the console answers 422 "Reveal the notes first.". Exporting as PNG from A's browser shows B's note empty.
- B7.9 With a vote open, clicking the private-writing button shows the toast "Close the vote first." and changes nothing; with private writing on, "Start a vote" is disabled and `POST vote-sessions` from the console answers 422 "Reveal the notes first.".
- B7.10 Two members type hidden notes at the same time for a minute: nobody sees the "reconnecting" banner, and each sees their own text and the other's marks.
- B7.11 The duplicate index (Task 2, rule 5). With private writing on, A and B each add a sticky note within the same second (before either browser has fetched the other's note) and both keep typing in their own note. Expected: neither sees the toast "Only its author can change a hidden note.", neither text editor closes, and each browser's network log shows at most a few `PUT elements` in the seconds after, not one every flush. `select element_id, data->>'index', version from whiteboard_elements where whiteboard_id = '<id>' order by data->>'index'` shows four different indices once both are idle, and both texts are intact. Then B closes the tab while A's canvas still holds B's note: A's `PUT elements` do not repeat. If the two notes cannot be created close enough together by hand, force the case: from A's console, `PUT elements` with A's masked copy of B's note text at a new index and `version + 1` (as in the test "takes the new index a canvas gives a hidden note of someone else, and nothing else") answers `rejected: []`, and B still reads the text.
- B7.12 While B is typing in B's own hidden note, A drags B's *other* hidden note: A gets the toast, B's editor stays open. While A is typing in A's own note, A's canvas is refused something about another note (A's console: `PUT elements` moving B's note does not go through the sync, so use B7.4's drag from a second tab of A): the editor of the first tab stays open.

---

### Task 8: Board UI — the history panel

Built and type-checked on the prototype, never opened in a browser. Names checked: props `viewModeEnabled?: boolean` and `initialData` with `scrollToContent?: boolean` (`dist/types/excalidraw/types.d.ts` line 436, `dist/types/excalidraw/data/types.d.ts` line 32); `CanvasActions` keys `changeViewBackgroundColor`, `clearCanvas`, `export`, `loadScene`, `saveToActiveFile`, `toggleTheme`, `saveAsImage` (`types.d.ts`, `export type CanvasActions`); `ExcalidrawImperativeAPI.addFiles(data: BinaryFileData[])` and `.refresh()` (`types.d.ts` lines 617–619); the classes `main-menu-trigger` and `help-icon` (`dist/dev/index.js` lines 17560 and 16716). Without a `<MainMenu>` child the canvas renders its default menu, which ends with links to the library's sites: the preview passes an empty one and hides its button.

**Files:**
- Create: `resources/js/lib/whiteboard/appearance.ts`, `resources/js/components/whiteboard/history-panel.tsx`, `resources/js/components/whiteboard/version-preview.tsx`
- Modify: `resources/js/lib/whiteboard/types.ts`, `resources/js/components/whiteboard/board.tsx`, `resources/css/app.css`, `lang/{en,fr,de,es}.json`

**Interfaces:**
- Consumes: Wayfinder actions generated by `npm run build` from Tasks 5–6: `WhiteboardVersionsController.index(boardId)`, `.store(boardId)`, `.show({ board, version })`, `.update({ board, version })`, `.destroy({ board, version })`, `WhiteboardVersionRestoresController.store({ board, version })`, `WhiteboardVersionCopiesController.store({ board, version })`; `retroRequest`, `RetroRequestError`; `useWhiteboardRequest()`; `restoreScene`; `downloadBoardFile(boardId, fileId)`; `Sheet`, `SheetContent`, `SheetTitle`, `Dialog` parts, `DropdownMenu` parts, `Skeleton`, `InputError`; `privateWriting`, `me.isGuest`, `me.isFacilitator`.
- Produces: `CanvasLocales`, `subscribeToTheme`, `isDark` (`appearance.ts`); `<HistoryPanel state open onOpenChange onRestored />`; `<VersionPreview boardId version title date onClose />`. Nothing for later tasks.

- [ ] **Step 1: Types** — append to `resources/js/lib/whiteboard/types.ts`:

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

- [ ] **Step 2: Share the canvas's locale and theme** — the preview is a second canvas and needs what `board.tsx` keeps to itself. Create `resources/js/lib/whiteboard/appearance.ts`:

```ts
/** The canvas's language codes for skrum's locales. */
export const CanvasLocales: Record<string, string> = {
    en: 'en',
    fr: 'fr-FR',
    de: 'de-DE',
    es: 'es-ES',
};

export function subscribeToTheme(onChange: () => void) {
    const observer = new MutationObserver(onChange);

    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
    });

    return () => observer.disconnect();
}

export const isDark = () => document.documentElement.classList.contains('dark');
```

In `board.tsx` delete the constant `ExcalidrawLocales` and the functions `subscribeToTheme` and `isDark`, import the three names from `@/lib/whiteboard/appearance`, and write `langCode={CanvasLocales[locale as string] ?? 'en'}`.

- [ ] **Step 3: The button and the panel in `board.tsx`** — import `History` from `lucide-react` and `{ HistoryPanel } from './history-panel'`; add `const [historyOpen, setHistoryOpen] = useState(false);`; among the children of `<TopBar>`, right before `<BoardMenu`:

```tsx
                    {!me.isGuest && (
                        <Button
                            size="icon"
                            variant="outline"
                            aria-label={t('Version history')}
                            title={t(
                                privateWriting
                                    ? 'Reveal the notes first.'
                                    : 'Version history',
                            )}
                            disabled={privateWriting}
                            onClick={() => setHistoryOpen(true)}
                        >
                            <History className="size-4" />
                        </Button>
                    )}
```

and right after `<BoardReactions state={state} />` (the reactions bar must stay the sibling that follows the canvas container: `app.css` relies on it):

```tsx
                {!me.isGuest && (
                    <HistoryPanel
                        state={state}
                        open={historyOpen && !privateWriting}
                        onOpenChange={setHistoryOpen}
                        onRestored={() => {
                            void sync.current?.resync();
                            void state.refetch();
                        }}
                    />
                )}
```

`top-bar.tsx` is not changed: it renders its children. The restore is broadcast to the others; the tab that asked for it fetches the delta itself, as it does after any write. The panel closes by itself when private writing is switched on.

- [ ] **Step 4: `history-panel.tsx`**

```tsx
import { router, usePage } from '@inertiajs/react';
import { MoreHorizontal } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import WhiteboardVersionCopiesController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardVersionCopiesController';
import WhiteboardVersionRestoresController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardVersionRestoresController';
import WhiteboardVersionsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardVersionsController';
import InputError from '@/components/input-error';
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
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardState } from '@/hooks/use-whiteboard';
import { useWhiteboardRequest } from '@/hooks/use-whiteboard-request';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { WhiteboardVersionSummary } from '@/lib/whiteboard/types';
import { VersionPreview } from './version-preview';

type Props = {
    state: WhiteboardState;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The board was rewritten: this tab has to fetch what the others were sent. */
    onRestored: () => void;
};

type Asked = {
    kind: 'restore' | 'rename' | 'delete';
    version: WhiteboardVersionSummary;
};

export function HistoryPanel({ state, open, onOpenChange, onRestored }: Props) {
    const { t } = useTrans();

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-full gap-4 overflow-y-auto p-4 sm:max-w-md"
                aria-describedby={undefined}
            >
                <SheetTitle>{t('Version history')}</SheetTitle>
                {open && <History state={state} onRestored={onRestored} />}
            </SheetContent>
        </Sheet>
    );
}

function History({ state, onRestored }: Pick<Props, 'state' | 'onRestored'>) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const request = useWhiteboardRequest();
    const { board, me } = state.snapshot;
    const [versions, setVersions] = useState<WhiteboardVersionSummary[] | null>(
        null,
    );
    const [loadError, setLoadError] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [nameError, setNameError] = useState<string | undefined>();
    const [saving, setSaving] = useState(false);
    const [previewed, setPreviewed] = useState<WhiteboardVersionSummary | null>(
        null,
    );
    const [asked, setAsked] = useState<Asked | null>(null);
    const dates = new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
    const labelOf = (version: WhiteboardVersionSummary) =>
        version.name ?? t('Automatic version');
    const dateOf = (version: WhiteboardVersionSummary) =>
        dates.format(new Date(version.createdAt));
    const failure = t('Something went wrong. Please try again.');

    const load = useCallback(async () => {
        setLoadError(null);

        try {
            setVersions(
                await retroRequest<WhiteboardVersionSummary[]>(
                    WhiteboardVersionsController.index(board.id),
                ),
            );
        } catch (error) {
            setVersions(null);
            setLoadError(
                error instanceof RetroRequestError && error.status > 0
                    ? error.message
                    : failure,
            );
        }
    }, [board.id, failure]);

    useEffect(() => {
        void load();
    }, [load]);

    const save = async (event: FormEvent) => {
        event.preventDefault();
        setSaving(true);
        setNameError(undefined);

        try {
            await retroRequest(WhiteboardVersionsController.store(board.id), {
                name,
            });
            toast.success(t('Version saved.'));
            setName('');
            await load();
        } catch (error) {
            setNameError(
                error instanceof RetroRequestError && error.status > 0
                    ? error.message
                    : failure,
            );
        } finally {
            setSaving(false);
        }
    };

    const copy = async (version: WhiteboardVersionSummary) => {
        const copied = await request(
            retroRequest<{ url: string }>(
                WhiteboardVersionCopiesController.store({
                    board: board.id,
                    version: version.id,
                }),
            ),
        );

        if (copied) {
            router.visit(copied.url);
        }
    };

    const restore = async (version: WhiteboardVersionSummary) => {
        const done = await request(
            retroRequest(
                WhiteboardVersionRestoresController.store({
                    board: board.id,
                    version: version.id,
                }),
            ),
        );

        if (done === undefined) {
            return;
        }

        toast.success(t('Version restored.'));
        setAsked(null);
        onRestored();
        await load();
    };

    const remove = async (version: WhiteboardVersionSummary) => {
        const done = await request(
            retroRequest(
                WhiteboardVersionsController.destroy({
                    board: board.id,
                    version: version.id,
                }),
            ),
        );

        if (done === undefined) {
            return;
        }

        setAsked(null);
        await load();
    };

    return (
        <>
            <form onSubmit={save} className="space-y-2">
                <div className="flex gap-2">
                    <Input
                        required
                        maxLength={80}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        aria-label={t('Version name')}
                        placeholder={t('Version name')}
                    />
                    <Button disabled={saving || name.trim() === ''}>
                        {t('Save this version')}
                    </Button>
                </div>
                <InputError message={nameError} />
            </form>

            {loadError !== null && (
                <div className="space-y-2">
                    <p role="alert" className="text-sm text-muted-foreground">
                        {loadError}
                    </p>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void load()}
                    >
                        {t('Retry')}
                    </Button>
                </div>
            )}

            {loadError === null && versions === null && (
                <div className="space-y-2" aria-busy="true">
                    <Skeleton className="h-14" />
                    <Skeleton className="h-14" />
                    <Skeleton className="h-14" />
                </div>
            )}

            {versions !== null && versions.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    {t('No version yet.')}
                </p>
            )}

            {versions !== null && versions.length > 0 && (
                <ul className="space-y-2">
                    {versions.map((version) => (
                        <li
                            key={version.id}
                            className="flex items-center gap-2 rounded-md border p-2"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                    {labelOf(version)}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                    {dateOf(version)}
                                    {version.createdByName !== null &&
                                        ` · ${t('by :name', { name: version.createdByName })}`}
                                </p>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPreviewed(version)}
                            >
                                {t('Preview')}
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        aria-label={t('Version actions')}
                                    >
                                        <MoreHorizontal className="size-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        onSelect={() => void copy(version)}
                                    >
                                        {t('Copy to a new board')}
                                    </DropdownMenuItem>
                                    {me.isFacilitator && (
                                        <>
                                            <DropdownMenuItem
                                                onSelect={() =>
                                                    setAsked({
                                                        kind: 'restore',
                                                        version,
                                                    })
                                                }
                                            >
                                                {t('Restore')}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onSelect={() =>
                                                    setAsked({
                                                        kind: 'rename',
                                                        version,
                                                    })
                                                }
                                            >
                                                {t('Rename')}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                variant="destructive"
                                                onSelect={() =>
                                                    setAsked({
                                                        kind: 'delete',
                                                        version,
                                                    })
                                                }
                                            >
                                                {t('Delete')}
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </li>
                    ))}
                </ul>
            )}

            <VersionPreview
                boardId={board.id}
                version={previewed}
                title={previewed === null ? '' : labelOf(previewed)}
                date={previewed === null ? '' : dateOf(previewed)}
                onClose={() => setPreviewed(null)}
            />

            <Dialog
                open={asked?.kind === 'restore'}
                onOpenChange={(open) => !open && setAsked(null)}
            >
                <DialogContent>
                    <DialogTitle>{t('Restore this version?')}</DialogTitle>
                    <DialogDescription>
                        {t(
                            'The board goes back to this version for everyone. The current state is saved first.',
                        )}
                    </DialogDescription>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setAsked(null)}
                        >
                            {t('Cancel')}
                        </Button>
                        <Button
                            onClick={() => asked && void restore(asked.version)}
                        >
                            {t('Restore')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={asked?.kind === 'delete'}
                onOpenChange={(open) => !open && setAsked(null)}
            >
                <DialogContent aria-describedby={undefined}>
                    <DialogTitle>{t('Delete this version?')}</DialogTitle>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setAsked(null)}
                        >
                            {t('Cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => asked && void remove(asked.version)}
                        >
                            {t('Delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={asked?.kind === 'rename'}
                onOpenChange={(open) => !open && setAsked(null)}
            >
                <DialogContent aria-describedby={undefined}>
                    {asked?.kind === 'rename' && (
                        <RenameVersionForm
                            boardId={board.id}
                            version={asked.version}
                            onRenamed={() => {
                                setAsked(null);
                                void load();
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

function RenameVersionForm({
    boardId,
    version,
    onRenamed,
}: {
    boardId: string;
    version: WhiteboardVersionSummary;
    onRenamed: () => void;
}) {
    const { t } = useTrans();
    const [name, setName] = useState(version.name ?? '');
    const [error, setError] = useState<string | undefined>();
    const [saving, setSaving] = useState(false);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setSaving(true);
        setError(undefined);

        try {
            await retroRequest(
                WhiteboardVersionsController.update({
                    board: boardId,
                    version: version.id,
                }),
                { name },
            );
            onRenamed();
        } catch (failure) {
            setError(
                failure instanceof RetroRequestError && failure.status > 0
                    ? failure.message
                    : t('Something went wrong. Please try again.'),
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <DialogTitle>{t('Rename')}</DialogTitle>
            <Input
                required
                maxLength={80}
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-label={t('Version name')}
            />
            <InputError message={error} />
            <DialogFooter>
                <Button disabled={saving || name.trim() === ''}>
                    {t('Save')}
                </Button>
            </DialogFooter>
        </form>
    );
}
```

What it does: a sheet on the right, above the page with its own overlay (it does not sit on the canvas while someone draws), content mounted only while open. A form saves a named version (a 422 — the cap, or validation — shows under the input and keeps what was typed). The list is loaded when the panel opens and after each action: three skeleton rows while loading, "No version yet." when empty, the server's message with "Retry" when it fails. Each row: the name or "Automatic version", the date in the viewer's locale and "by <name>", "Preview", and a menu with "Copy to a new board" for everyone and "Restore", "Rename", "Delete" for the facilitator. Restore and delete ask for confirmation; every failed action says why in a toast and leaves the panel and its dialog as they were (spec §13).

- [ ] **Step 5: `version-preview.tsx`**

```tsx
import { usePage } from '@inertiajs/react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import WhiteboardVersionsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardVersionsController';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrans } from '@/hooks/use-trans';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import {
    CanvasLocales,
    isDark,
    subscribeToTheme,
} from '@/lib/whiteboard/appearance';
import {
    Excalidraw,
    MainMenu,
    type ExcalidrawImperativeAPI,
} from '@/lib/whiteboard/excalidraw';
import { downloadBoardFile } from '@/lib/whiteboard/files';
import { restoreScene } from '@/lib/whiteboard/restore';
import type {
    WhiteboardVersionScene,
    WhiteboardVersionSummary,
} from '@/lib/whiteboard/types';

type Props = {
    boardId: string;
    version: WhiteboardVersionSummary | null;
    title: string;
    date: string;
    onClose: () => void;
};

export function VersionPreview({
    boardId,
    version,
    title,
    date,
    onClose,
}: Props) {
    return (
        <Dialog
            open={version !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent
                className="flex h-[85vh] flex-col sm:max-w-6xl"
                aria-describedby={undefined}
            >
                <DialogTitle>
                    {title}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {date}
                    </span>
                </DialogTitle>
                {version !== null && (
                    <PreviewCanvas boardId={boardId} versionId={version.id} />
                )}
            </DialogContent>
        </Dialog>
    );
}

/**
 * A second canvas, read-only, fed once: no onChange, no scene sync, no
 * cursors. Nothing done here is written anywhere.
 */
function PreviewCanvas({
    boardId,
    versionId,
}: {
    boardId: string;
    versionId: string;
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const dark = useSyncExternalStore(subscribeToTheme, isDark, () => false);
    const [scene, setScene] = useState<WhiteboardVersionScene | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
    const failure = t('Something went wrong. Please try again.');

    useEffect(() => {
        let cancelled = false;

        retroRequest<WhiteboardVersionScene>(
            WhiteboardVersionsController.show({
                board: boardId,
                version: versionId,
            }),
        )
            .then((fetched) => {
                if (!cancelled) {
                    setScene(fetched);
                }
            })
            .catch((caught: unknown) => {
                if (!cancelled) {
                    setError(
                        caught instanceof RetroRequestError && caught.status > 0
                            ? caught.message
                            : failure,
                    );
                }
            });

        return () => {
            cancelled = true;
        };
    }, [boardId, versionId, failure]);

    useEffect(() => {
        if (!api || !scene) {
            return;
        }

        let cancelled = false;

        // The dialog opens with a zoom: the canvas measured itself too early.
        const settled = setTimeout(() => api.refresh(), 300);

        for (const file of scene.files) {
            downloadBoardFile(boardId, file.id)
                .then(({ dataURL, mimeType }) => {
                    if (cancelled) {
                        return;
                    }

                    api.addFiles([
                        {
                            id: file.id,
                            dataURL,
                            mimeType,
                            created: Date.now(),
                        } as never,
                    ]);
                })
                .catch(() => undefined);
        }

        return () => {
            cancelled = true;
            clearTimeout(settled);
        };
    }, [api, scene, boardId]);

    if (error !== null) {
        return (
            <p role="alert" className="text-sm text-muted-foreground">
                {error}
            </p>
        );
    }

    if (scene === null) {
        return <Skeleton className="min-h-0 flex-1" />;
    }

    return (
        <div className="whiteboard-preview relative min-h-0 flex-1">
            <Excalidraw
                excalidrawAPI={setApi}
                initialData={{
                    elements: restoreScene(scene.elements) as never,
                    scrollToContent: true,
                }}
                viewModeEnabled
                langCode={CanvasLocales[locale as string] ?? 'en'}
                theme={dark ? 'dark' : 'light'}
                aiEnabled={false}
                UIOptions={{
                    canvasActions: {
                        loadScene: false,
                        saveToActiveFile: false,
                        toggleTheme: false,
                        export: false,
                        saveAsImage: false,
                        clearCanvas: false,
                        changeViewBackgroundColor: false,
                    },
                }}
            >
                {/* Without a menu of ours the canvas renders its own, with links to the library's sites. */}
                <MainMenu />
            </Excalidraw>
        </div>
    );
}
```

No `onChange`, no scene sync, no cursors: nothing the viewer does in the preview is written anywhere. The images are added the way `scene-sync.ts` adds the board's own; a failed download leaves the image's placeholder. `api.refresh()` after the dialog's opening animation makes the canvas measure its place again. The dialog is a child of the sheet in the React tree, which is how Radix stacks one modal on another.

- [ ] **Step 6: The preview shows no menu and no help button** — append to the board block of `resources/css/app.css` (after the rule about `toggleElementLock`):

```css
/*
 * The preview of a version (spec §9) is a second, read-only canvas inside a
 * dialog. Its menu button and its help button open panels of Excalidraw
 * 0.18.1 that the dialog would cover or that link to the library's sites,
 * and neither has a prop: both are hidden.
 */
.whiteboard-preview .main-menu-trigger,
.whiteboard-preview .help-icon {
    display: none !important;
}
```

- [ ] **Step 7: Translations**

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

"Preview", "Restore", "Rename", "Delete", "Cancel", "Save", "Retry", "by :name", "Reveal the notes first." and "Something went wrong. Please try again." exist. Run `grep -n '"<key>"' lang/fr.json` for each new row first: `tests/Feature/TranslationKeysTest.php` is the judge.

- [ ] **Step 8: Gates and commit**

Run: `npm run build && npm run types:check && npx vp check resources/js/lib/whiteboard/types.ts resources/js/lib/whiteboard/appearance.ts resources/js/components/whiteboard/board.tsx resources/js/components/whiteboard/history-panel.tsx resources/js/components/whiteboard/version-preview.tsx && DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: no error in these files; test PASS.

```bash
git add resources/js/lib/whiteboard/types.ts resources/js/lib/whiteboard/appearance.ts resources/js/components/whiteboard/board.tsx resources/js/components/whiteboard/history-panel.tsx resources/js/components/whiteboard/version-preview.tsx resources/css/app.css lang/en.json lang/fr.json lang/de.json lang/es.json
git commit -m "feat(whiteboard): history panel with preview, restore and copy to a new board"
```

**Browser checks (for the walkthrough):**
- B8.1 A member sees the history button (clock icon) in the top bar, left of the board menu; a guest (127.0.0.1) does not. While private writing is on the button is disabled with the title "Reveal the notes first.", and an open panel closes.
- B8.2 The panel lists versions newest first; an automatic one reads "Automatic version" with its date, a named one its name, date and "by <name>".
- B8.3 "Save this version" with a name adds it on top with a success toast; an empty name cannot be submitted.
- B8.4 "Preview" opens a dialog with a read-only canvas showing that version, images included, that can be panned and zoomed but not edited; it has no menu button and no help button; no library name, logo or link appears; closing it leaves the board untouched (no `PUT elements` in the network log while the preview was open) and the sticky-note button is still in the board's own toolbar.
- B8.5 Facilitator: "Restore" asks for confirmation, then every browser (member B and a guest too) shows the version's scene within about a second without a reload, and a "Before restore · <date>" version is on top of the list. Restoring that one brings the previous state back in every browser.
- B8.6 A non-facilitating member sees "Copy to a new board" only in the row menu; the facilitator also sees "Restore", "Rename", "Delete".
- B8.7 "Copy to a new board" lands on "<title> (copy)" with the version's elements and images, the member as facilitator; the source board is unchanged.
- B8.8 Rename and delete update the list; a failed action (rename with 81 characters through the console, or stop the server) leaves the panel and its dialog open with a message.
- B8.9 After five minutes of edits (or after running `vendor/bin/sail artisan queue:work --once` once the delayed job is due) an "Automatic version" appears when the panel is reopened.
- B8.10 Restoring while a vote is open ends the vote in every browser without results; badges of a closed vote disappear and the results panel closes.
- B8.11 A version saved while notes were hidden, then previewed after the reveal: it shows the revealed notes and not the one that was deleted before the reveal.

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

1. **Given private writing is on, when member A writes a sticky, then member B and the facilitator see a masked note at the same place and no payload they receive contains its text.** Setup: facilitator A and member B on the same board, private writing on. Action: B writes a note "Secret idea"; A fetches `GET snapshot` and `GET elements?since=0` from the console. Expected: A sees the note masked with "•••" at the same place, same size and colour; neither response contains "Secret idea"; B's second tab shows the text. Include B7.1, B7.2, B7.3, B7.5, B7.6, B7.10.
2. **Given a masked note, when another member edits or deletes it, then the write is rejected and the author's text is intact.** Setup: as 1. Action: A drags, erases and types on B's note; A sends `PUT elements` from the console with the masked text at `version + 1` and `text: "Overwritten"`. Expected: each attempt returns to the masked note; the console call answers `rejected[0].reason = "private"` with an element whose `text` is empty; `select data->>'text' from whiteboard_elements where element_id = '<text id>'` still reads "Secret idea". Include B7.4, B7.11, B7.12.
3. **Given the facilitator reveals, then every member sees every note's text without reloading.** Setup: as 1, plus a second hidden note B deleted. Action: A clicks "Reveal the notes". Expected: every browser shows "Secret idea" within about a second; the deleted note does not come back; the banner and the marks are gone. Include B7.7.
4. **While private writing is on, voting, version history, duplicate and save-as-template answer 422 "Reveal the notes first."** Setup: private writing on. Action: from A's console, `POST duplicate`, `POST template`, `GET versions`, `GET versions/<id>`, `POST versions/<id>/restore`, `POST versions/<id>/copy`, and opening a vote. Expected: 422 with that message for each; the menu entries, "Start a vote" and the history button are disabled. `POST versions` (saving) answers 201: it returns nothing of a scene (spec §9). Include B7.8, B7.9, B8.1.

Version history (R10)

5. **Given edits over more than 5 minutes, then automatic versions exist, at most one per 5 minutes, and never more than 50.** Setup: a board, the queue worker running. Action: edit, wait five minutes, edit again, wait five minutes; read `select name, seq, created_at from whiteboard_versions where whiteboard_id = '<id>' order by created_at`. Expected: one automatic version per five-minute window of activity, none while idle. The cap of 50 is pinned by `WhiteboardAutomaticVersionsTest` ("keeps the last fifty automatic versions and every named one") and not replayed by hand. Include B8.2, B8.9.
6. **Given a version, when the facilitator restores it, then every connected browser shows that scene and a "Before restore" version exists that restores the prior state.** Setup: A and B on a board with a saved version, then more edits. Action: A restores the version, then restores "Before restore · …". Expected: both browsers show the version, then the previous state, each time without a reload. Include B8.3, B8.4, B8.5, B8.6, B8.7, B8.8, B8.10, B8.11.
7. **A guest gets 403 on every version endpoint.** Setup: guest on 127.0.0.1. Action: from the guest's console, the seven version requests (`GET versions`, `POST versions`, `GET`, `PATCH`, `DELETE versions/<id>`, `POST …/restore`, `POST …/copy`). Expected: 403 "Guests cannot do this." for each; no history button.

End with a "Feature tests that pin these criteria" list: `WhiteboardPrivateWritingTest`, `WhiteboardPrivateWritingSwitchTest`, `WhiteboardAutomaticVersionsTest`, `WhiteboardVersionsTest`, `WhiteboardVersionRestoreTest`, `WhiteboardSecrecyModelTest`, and a table "surface of the invariant → test" with these rows: snapshot, Inertia page and `GET elements` → "masks a private note for everyone but its author"; `rejected` copies → "refuses every change another member makes to a private note and keeps the text"; the index repair → "takes the new index a canvas gives a hidden note of someone else, and nothing else" and "takes nothing but an index from the canvas of another member"; `elements.changed` → "never broadcasts the elements of a write that touches a private note" and "reveals every live private note and makes every client fetch it"; versions → "keeps the history closed while the notes are hidden", "refuses to copy a version for guests, outsiders and while the notes are hidden", "never previews a note that was deleted before the reveal", "never restores or copies a note that was deleted before the reveal" and "keeps a note deleted while hidden out of a version when its id is used again"; voting → "refuses to hide the notes while a vote is open" and "refuses to open a vote while the notes are hidden"; duplicate and template → "refuses duplicate and save as template until the notes are revealed" and "copies the notes once they are revealed, and never one deleted while hidden"; export → client-side from the masked copies (B7.8); log lines → "keeps the text of a note out of the log, even when the database refuses the write" and "keeps the scene out of the log when a version cannot be stored".

- [ ] **Step 2: Full gates**

```bash
vendor/bin/pint --dirty --format agent
DB_HOST=127.0.0.1 php -d memory_limit=-1 vendor/bin/pest --compact
composer lint
npm run build && npm run types:check
npx vp check resources/js/lib/whiteboard resources/js/components/whiteboard resources/js/hooks/use-whiteboard.ts resources/js/hooks/use-whiteboard-overlay.ts
vendor/bin/sail artisan migrate --no-interaction
```

Expected: the suite passes; PHPStan and Pint clean; `types:check` shows only the known `manage-passkeys.tsx` error; no `vp check` failure in the listed files. Confirm no dependency changed: `git diff <base of this plan> -- package.json composer.json` is empty.

- [ ] **Step 3: Check the invariant once more by reading**

Run `grep -rn "->data\b" app/Actions/Whiteboards app/Http/Controllers/Whiteboards app/Events/Whiteboards app/Jobs/StoreAutomaticWhiteboardVersion.php` and, for every hit outside `PresentWhiteboardElement`, state in the report where the value goes: a server-side copy guarded by `notPrivateWriting`, a version row, the restore, an index, lock or voting comparison, the text a closing vote copies into its results (no live private row exists while a vote is open, Task 3 Step 7), or — the only broadcast — `WriteWhiteboardElements::broadcastable()` after its private check. A hit that reaches a response, a broadcast or a log without one of these is a defect: fix it with a test. Do the same for `Log::`, `logger(` and `report(` in the same folders (expected: none that receives an element, a scene or a version).

- [ ] **Step 4: Fix what the gates show**, re-run the affected gate, and record each fix in the report.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md
git commit -m "docs(whiteboard): walkthrough for private writing and version history"
```

(Add any fixed file by its explicit path to the same or a separate commit.)

**UI strings added by this task:** none.

---

## Appendix: translation keys

Every key this plan adds, by task (each task repeats its own rows). English value = key.

| Task | Key (English) | French | German | Spanish |
|---|---|---|---|---|
| 3 | Reveal the notes first. | Révélez d'abord les post-it. | Decken Sie zuerst die Haftnotizen auf. | Revela primero las notas. |
| 5 | This board already has 100 saved versions. | Ce tableau a déjà 100 versions enregistrées. | Dieses Board hat bereits 100 gespeicherte Versionen. | Esta pizarra ya tiene 100 versiones guardadas. |
| 6 | Before restore · :date | Avant restauration · :date | Vor der Wiederherstellung · :date | Antes de restaurar · :date |
| 7 | Private writing | Écriture privée | Privates Schreiben | Escritura privada |
| 7 | Reveal the notes | Révéler les post-it | Haftnotizen aufdecken | Revelar las notas |
| 7 | Notes are hidden until the facilitator reveals them. Other elements stay visible. | Les post-it sont masqués jusqu'à ce que l'animateur les révèle. Les autres éléments restent visibles. | Haftnotizen bleiben verborgen, bis der Moderator sie aufdeckt. Andere Elemente bleiben sichtbar. | Las notas quedan ocultas hasta que el facilitador las revele. Los demás elementos siguen visibles. |
| 7 | The size of a note hints at the length of its text. | La taille d'un post-it laisse deviner la longueur de son texte. | Die Größe einer Haftnotiz lässt die Länge ihres Textes erahnen. | El tamaño de una nota deja intuir la longitud de su texto. |
| 7 | Hidden note | Post-it masqué | Verborgene Haftnotiz | Nota oculta |
| 7 | Only its author can change a hidden note. | Seul son auteur peut modifier un post-it masqué. | Nur der Autor kann eine verborgene Haftnotiz ändern. | Solo su autor puede modificar una nota oculta. |
| 8 | Version history | Historique des versions | Versionsverlauf | Historial de versiones |
| 8 | Version name | Nom de la version | Name der Version | Nombre de la versión |
| 8 | Save this version | Enregistrer cette version | Diese Version speichern | Guardar esta versión |
| 8 | Version saved. | Version enregistrée. | Version gespeichert. | Versión guardada. |
| 8 | No version yet. | Aucune version pour l'instant. | Noch keine Version. | Aún no hay versiones. |
| 8 | Automatic version | Version automatique | Automatische Version | Versión automática |
| 8 | Version actions | Actions sur la version | Aktionen für die Version | Acciones de la versión |
| 8 | Copy to a new board | Copier dans un nouveau tableau | In ein neues Board kopieren | Copiar a una pizarra nueva |
| 8 | Restore this version? | Restaurer cette version ? | Diese Version wiederherstellen? | ¿Restaurar esta versión? |
| 8 | The board goes back to this version for everyone. The current state is saved first. | Le tableau revient à cette version pour tout le monde. L'état actuel est d'abord enregistré. | Das Board kehrt für alle zu dieser Version zurück. Der aktuelle Stand wird vorher gespeichert. | La pizarra vuelve a esta versión para todos. Antes se guarda el estado actual. |
| 8 | Version restored. | Version restaurée. | Version wiederhergestellt. | Versión restaurada. |
| 8 | Delete this version? | Supprimer cette version ? | Diese Version löschen? | ¿Eliminar esta versión? |

## Spec edits made with this plan

Each is a decision the spec needed for this slice; none changes a behaviour the user decided. Items 1–13 were written with the first version of this plan; items 14–18 with the reconciliation; items 19–20 after the adversarial check.

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
14. **§7 `whiteboard_versions.private_element_ids`** (new column) and **§9 "What a version shows"**: a version remembers which elements were private when it was stored; the reveal takes the revealed ones off the list; preview, restore and copy leave out what stays on it. Without it, item 10's promise was false: a version stored while a note was still on the board would have shown it after the reveal.
15. **§11.5 reveal:** a write by its author that leaves a hidden-deleted note deleted keeps it private; only bringing it back makes it ordinary.
16. **§9 restore:** the votes of the session a restore closes are deleted, as at an ordinary close.
17. **§11.5 scope / §13:** the sentence about hidden notes is an item of the status row; the switch is a button of the facilitator bar; "•••" marks use the overlay layer of the vote badges.
18. **§13 history:** the history button sits in the top bar for non-guests; the preview is a read-only canvas in a dialog, without the canvas's menu and help buttons.
19. **§11.5 write rules:** the one write of a private sticky by another member that is accepted — the canvas's repair of a duplicate stacking index — and what the server takes from it (the index, version and nonce; never text, position or deletion). The spec said "only the author may change", which made every other canvas repeat a refused write for as long as two hidden notes shared an index.
20. **§7 and §9 "What a version shows":** the reveal takes an element off a version's list only when its row is not younger than the version. The spec keyed the list by id alone, and an id can be used again once its tombstone is purged.

## Reconciliation with plans 17b and 17c

What the first version of this plan assumed, and what the branch really holds at `aff67e7`:

- **Voting (17c):** model `WhiteboardVoteSession` (`element_ids`, `results` cast to array, `isOpen()`, `votes()`), `Whiteboard::voteSessions()`, route `whiteboards.voteSessions.store` with `votes_per_member` / `allow_multiple`, helpers `whiteboardSticky()`, `openWhiteboardVote()`, `castWhiteboardVote()`, factory state `closed()`. The former "17c steps" that used the query builder now use these. `OpenWhiteboardVote` had no private-writing check: Task 3 adds it. "Close the vote first." already existed and is reused.
- **`WriteWhiteboardElements` (17c):** has a deferral queue for the voting text freeze and loads containers only while a vote is open. Task 2 was rewritten against it: containers are always loaded, `private` sits in `refusal()` after `stale`, the voting reasons stay after it.
- **`WhiteboardSettingsController` (17c):** validates `locked` and `follow_enabled`; Task 3 shows the whole method with `private_writing` added.
- **Snapshot, model, types (17c):** `locked`, `followEnabled`, `timerEndsAt`, `voting`, `votingHistory` exist; this plan's keys are inserted after `followEnabled`.
- **Board UI (17c):** a facilitator bar, a status row and an overlay layer exist. The switch moved from the board menu to the facilitator bar, the banner became an item of the status row, the marks use `useCanvasView` and a hook beside `useNoteBoxes`, requests use `useWhiteboardRequest`.
- **Board menu (17b Task 8):** "Duplicate this board" and "Save as template" are `DropdownMenuItem`s of `board-menu.tsx`; Task 7 disables them. `DuplicateWhiteboard` and `SaveWhiteboardTemplate` have the shape the first version read.
- **Migration date:** 17c's is `2026_10_11_100000`; `2026_10_12_100000` stays.
- **Found by the adversarial check after the prototype, by reading the library and the sync code (not built, not run):** the repeated refused write when two hidden notes share an index (spec edit 19; Task 2 rule 5, Task 7 `onRejected`), and the re-use of a purged id to open a version's never-revealed list (spec edit 20; Task 3 `revealInVersions()`).
- **Found while prototyping, not assumptions:** the never-revealed hole in versions (spec edit 14) and in tombstone rewrites (15); `now()->locale()` does not pass PHPStan; the history button needs no change to `top-bar.tsx`; `DialogContent` needs `sm:max-w-6xl` (its default is `sm:max-w-lg`); the preview dropped "Save as image" because the canvas opens that dialog outside the Radix dialog, where it cannot be used.

**Things only a browser can show** (collected in the walkthrough): that a masked note is drawn empty with its mark and stays so through pan, zoom and remote updates; that the reveal replaces the masked copies without a reload in every tab, the facilitator's included; that closing the text editor on a `private` refusal leaves the canvas calm, and that it closes only for the note being typed into; that two hidden notes created with the same index settle without toasts or repeated writes (B7.11); that the preview canvas shows no library branding and writes nothing; that two canvases on one page (the board and the preview) do not disturb the sticky-note button, which looks for the toolbar inside the board's own container; that a dialog opened from the sheet stacks and closes cleanly.

## Corrections

- **Task 3, `revealInVersions()` (review of Task 3, fix round 1):** the age check alone took a note off an older version's list when it had been deleted while hidden, held back by a reveal, then brought back by its author with private writing on again and revealed (spec §9: it "stays out of those older versions"). `reveal()` now stamps every private tombstone it leaves hidden (`whiteboard_elements.withheld_at`, migration `2026_10_12_100100`, written through the base query so the purge's `updated_at` does not move) and `revealInVersions()` skips a row whose stamp is not older than the version; spec §7 and §9 say so. Pinned by "keeps a note deleted while hidden out of an older version when its author brings it back hidden".
