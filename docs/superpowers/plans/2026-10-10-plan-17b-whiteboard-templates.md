# Whiteboard Templates (Plan 17b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A team member starts a whiteboard from one of eight built-in templates or from a template the workspace saved from a board, duplicates a board, and exports it.

**Architecture:** One server-side copy path (`CopyWhiteboardScene`) turns a *scene* (`{elements, files}`) into the first elements of a new board: every element goes through `SanitizeWhiteboardElement`, gets a fresh id, a fresh fractional index in the same order and version 1, and every reference is rewritten. Built-in templates, workspace templates and "duplicate" are three sources of a scene feeding that one path. A workspace template stores its scene and its own copy of the images, so nothing ties it to the board it came from. The team page gets a gallery whose thumbnails are drawn in the browser from a text-free outline computed on the server.

**Tech Stack:** Laravel 13, PHP 8.4, PostgreSQL, Pest 5, Inertia 3 + React 19, Wayfinder, `@excalidraw/excalidraw` 0.18.1 (only through `resources/js/lib/whiteboard/excalidraw.ts`).

**Spec:** `docs/superpowers/specs/2026-10-01-whiteboard-design.md` — this plan covers R5 (rest) and R6: §10, the `template` / `workspace_template_id` parameters and template rows of §12, `whiteboard_templates` of §7, the team page additions of §12/§13, template file ownership of §6.5, and "Templates and export" of §16. Read it and `.superpowers/sdd/whiteboard-rules.md` before starting.

**Not in this plan:** private writing does not exist yet (17d), so "blocked while private writing is on" for duplicate and save-as-template, and "a masked note exports masked", are added by 17d in `DuplicateWhiteboard`, `SaveWhiteboardTemplate` and the presenter. Versions (17d) will reuse `CopyWhiteboardScene` and `ReadWhiteboardScene`. Timer, lock, voting: 17c.

**How the backend code here was checked:** every PHP file and test given verbatim in Tasks 2–6 was run against this repository before the plan was written (whiteboard suite 333 tests green, PHPStan clean on the touched files, Pint applied), then removed from the tree. Frontend code (Tasks 1, 7, 8) was *not* run: it is a proposal checked only against the type files cited.

## Global Constraints

- No new dependency, PHP or JS. No JavaScript test runner: client logic stays thin.
- Every primary and foreign key is a UUID (`tests/Feature/UuidPrimaryKeysTest.php`). Migrations have `up` only.
- Request bodies are snake_case (`workspace_template_id`); Excalidraw elements keep camelCase.
- Route names are camelCase segments, URLs kebab-case, controllers plural with CRUD method names, one controller per non-CRUD action.
- Every UI string goes through `__()` / `t()` with its key in `lang/en.json`, `fr.json`, `de.json`, `es.json` (`tests/Feature/TranslationKeysTest.php`); texts of built-in scenes live in `lang/{locale}/whiteboards.php`. Translations: Appendix A.
- The board UI never names the canvas library and shows none of its branding.
- PHP: early returns, no `else`, braces always, typed everything, no comment that restates code. `vendor/bin/pint --dirty --format agent` and `vendor/bin/phpstan analyse --memory-limit=1G <touched php files>` before each commit.
- Frontend: URLs only through Wayfinder (`@/actions/...`); `npm run build`, then `npm run types:check` (one known error in `resources/js/components/manage-passkeys.tsx` is not yours) and `npx vp check <files you touched>`. Leave `public/build` fresh.
- Tests: `DB_HOST=127.0.0.1 php artisan test --compact <paths>`. After a migration also run `vendor/bin/sail artisan migrate --no-interaction`.
- Git: `git add` explicit paths only; never stage `.junie/mcp/mcp.json`; every commit ends with the trailer of `.superpowers/sdd/whiteboard-rules.md`.
- Limits from the spec: template name 1–80, unique per workspace case-insensitively; description up to 300; 50 templates per workspace; board title 120; 5 000 live elements per board.
- Anything the server copies must pass `SanitizeWhiteboardElement`, carry valid fractional indices in canvas order, fresh ids and remapped references (`boundElements[].id`, `containerId`, `frameId`, `startBinding/endBinding.elementId`, `groupIds`).

## Review Focus

1. **A scene that refers to an element that is not in it** (an arrow bound to a deleted shape, a text whose container was erased): the copy must load, with the dangling reference dropped, never copied or pointed at a stranger. Pinned in Task 2 ("drops a reference to an element that is not in the scene").
2. **An image whose stored file is gone** (pruned, disk fault) in a template or a duplicated board: creation succeeds and leaves that image out; it never answers 500 and never creates an image element without a file. Pinned in Task 2 ("leaves out an image whose stored file is gone instead of failing").
3. **A translated label longer than the English one**: it must still fit inside its shape in every locale, because the canvas does not re-measure text handed to it. Pinned in Task 3 ("keeps every label inside its shape in every locale").
4. **A template name that differs only by case or surrounding spaces**, on save and on rename, and renaming a template to its own name: refused / accepted as a person expects, with the database index as last line. Pinned in Task 4 ("refuses a name already used…", "keeps names unique when renaming, but lets a template keep its own", "keeps the name unique in the database too").
5. **The nightly prune running while a copy is in flight**: files are written before the transaction that creates their owner commits, so a folder with a recent file must survive even when no owner row is visible yet. Pinned in Task 4 ("prunes the folder of a template that is gone, once its files are a day old" and the edited prune test).

---

## File Structure

Backend (new unless marked):

| Path | Responsibility |
|---|---|
| `app/Actions/Whiteboards/GenerateFractionalIndexes.php` | `n` valid indices in canvas order |
| `app/Actions/Whiteboards/RemapWhiteboardScene.php` | Fresh ids, indices, versions; references rewritten |
| `app/Actions/Whiteboards/CopyWhiteboardScene.php` | Scene → rows and files of a new board |
| `app/Actions/Whiteboards/ReadWhiteboardScene.php` | Live scene of a board (server-only) |
| `app/Actions/Whiteboards/CreateWhiteboard.php` (modify) | Optional scene |
| `app/Support/WhiteboardTemplates/BuiltInTemplates.php` | Expands and translates built-in scenes |
| `resources/whiteboard-templates/*.json` | Eight scenes |
| `lang/{en,fr,de,es}/whiteboards.php` | Names, descriptions, texts |
| `database/migrations/2026_10_10_100000_create_whiteboard_templates_table.php` | Table |
| `app/Models/WhiteboardTemplate.php`, `database/factories/WhiteboardTemplateFactory.php` | Model |
| `app/Models/Workspace.php` (modify) | `whiteboardTemplates()` |
| `app/Policies/WhiteboardTemplatePolicy.php` | Creator or Owner/Admin |
| `app/Actions/Whiteboards/WhiteboardTemplateRules.php` | Cap and unique name, under lock |
| `app/Actions/Whiteboards/PresentWhiteboardPreview.php` | Text-free outline for thumbnails |
| `app/Actions/Whiteboards/SaveWhiteboardTemplate.php` | Board → template |
| `app/Actions/Whiteboards/DuplicateWhiteboard.php` | Board → board |
| `app/Actions/Whiteboards/BuildWhiteboardGallery.php` | Gallery items |
| `app/Actions/Whiteboards/PresentWhiteboardSummary.php` (modify) | `canDelete` |
| `app/Actions/Whiteboards/WhiteboardGuard.php` (modify) | `notGuest` |
| `app/Actions/Whiteboards/PruneWhiteboardFiles.php` (modify) | Template folders; recent-file guard |
| `app/Http/Controllers/TeamWhiteboardsController.php` (modify) | `template`, `workspace_template_id` |
| `app/Http/Controllers/Whiteboards/WhiteboardTemplatesController.php`, `WhiteboardDuplicatesController.php` | `POST template`, `POST duplicate` |
| `app/Http/Controllers/WorkspaceWhiteboardTemplatesController.php` | PATCH, DELETE |
| `app/Http/Controllers/TeamsController.php`, `routes/web.php` (modify) | Props, routes |

Frontend (new unless marked):

| Path | Responsibility |
|---|---|
| `resources/js/lib/whiteboard/scene-sync.ts` (modify) | 409 through `recover()` |
| `resources/js/components/teams/whiteboard-template-preview.tsx` | SVG thumbnail |
| `resources/js/components/teams/new-whiteboard-dialog.tsx` (modify) | Gallery |
| `resources/js/components/teams/whiteboard-templates-dialog.tsx` | Manage templates |
| `resources/js/components/teams/whiteboards-section.tsx`, `resources/js/pages/teams/show.tsx`, `resources/js/types/poker.ts` (modify) | Delete action, props, types |
| `resources/js/components/whiteboard/save-template-dialog.tsx` | Save as template |
| `resources/js/components/whiteboard/board-menu.tsx`, `board.tsx` (modify) | Duplicate, save as template, export name |

Shared types used by several tasks (PHPStan aliases defined on `CopyWhiteboardScene` and `PresentWhiteboardPreview`):

```
SceneFile = array{fileId: string, path: string, mimeType: string, size: int}
Scene     = array{elements: list<array<string, mixed>>, files: list<SceneFile>}
Shape     = array{kind: 'rect'|'ellipse'|'diamond'|'path'|'text', x: int, y: int, width: int, height: int, fill: ?string, stroke: ?string, points: list<array{0: int, 1: int}>}
Preview   = array{width: int, height: int, shapes: list<Shape>}
```

---

### Task 1: Retry the snapshot when the client is older than the purge mark

Left open by plan 17a. In `resources/js/lib/whiteboard/scene-sync.ts` the 409 branch of `resync()` calls `replaceScene()` once; a failed snapshot is never retried and, on success, the banner is not cleared. `recover()` (same file) already retries with a growing delay, clears the banner and resyncs afterwards.

**Files:**
- Modify: `resources/js/lib/whiteboard/scene-sync.ts` (the `catch` of `resync`, about lines 463–473)

**Interfaces:**
- Consumes: `recover(): void` in the same closure (defined above `resync`).
- Produces: nothing new; `SceneSync` is unchanged.

- [ ] **Step 1: Route the 409 through `recover()`**

Replace

```ts
                } else if (
                    error instanceof RetroRequestError &&
                    error.status === 409
                ) {
                    await replaceScene().catch(() => setOffline(true));
                } else {
```

with

```ts
                } else if (
                    error instanceof RetroRequestError &&
                    error.status === 409
                ) {
                    // Older than the purge mark: no delta can catch up.
                    recover();
                } else {
```

Do not `await` it: `recover()` owns its retries, and its success path already calls `setOffline(false)` and `resync()` when `seq < wantedSeq`. Check that `setOffline(false)` two lines above (end of the `try`) is not reached on this path (it is not: the throw skips it) and that `recoveryOwed` therefore keeps the banner up until the snapshot is applied. Change nothing else.

- [ ] **Step 2: Gates**

Run: `npm run build && npm run types:check && npx vp check resources/js/lib/whiteboard/scene-sync.ts`
Expected: no error in this file.

- [ ] **Step 3: Commit**

```bash
git add resources/js/lib/whiteboard/scene-sync.ts
git commit -m "fix(whiteboard): retry the snapshot when the client predates the purge"
```

**Browser checks (for the walkthrough):**
- B1.1 With a board open, raise the purge mark (`update whiteboards set purged_seq = seq where id = '<id>'` through psql), then make the page fetch a delta (toggle the tab offline/online or wait for a remote change): the scene stays intact, `GET snapshot` is requested, and the "Reconnecting…" banner disappears.
- B1.2 Same, with `GET snapshot` failing first (block the URL in devtools, then unblock): the banner stays, a retry happens after about 2 s then 4 s, and the banner clears on success.

---

### Task 2: The scene copy path

**Files:**
- Create: `app/Actions/Whiteboards/GenerateFractionalIndexes.php`, `RemapWhiteboardScene.php`, `CopyWhiteboardScene.php`, `ReadWhiteboardScene.php`
- Modify: `app/Actions/Whiteboards/CreateWhiteboard.php`
- Test: `tests/Feature/Whiteboards/CopyWhiteboardSceneTest.php`

**Interfaces:**
- Consumes: `SanitizeWhiteboardElement::handle(mixed): ?array`, `OrderWhiteboardElements::handle(Collection): Collection`, `Whiteboard::storageDirectory()`, `Whiteboard::MaxLiveElements`, helpers `sceneElement()`, `teamMember()`.
- Produces:
  - `GenerateFractionalIndexes::handle(int $count): list<string>` — `a0…az`, `b00…bzz`, `c000…`
  - `RemapWhiteboardScene::handle(list<array> $elements): list<array>`
  - `CopyWhiteboardScene::handle(Whiteboard $board, WhiteboardMember $author, array $scene): void` (board must be new; caller holds the transaction) and the PHPStan types `Scene`, `SceneFile`
  - `ReadWhiteboardScene::handle(Whiteboard $board): Scene` — stored data with real text; never sent to a client
  - `CreateWhiteboard::handle(Team $team, User $creator, string $title, array $scene = ['elements' => [], 'files' => []]): Whiteboard`

Facts checked: fractional-index rules are those of `SanitizeWhiteboardElement::isFractionalIndex` (integer part length from the head letter; no trailing `0` in the fraction); `Builder::fillAndInsert` exists (`vendor/laravel/framework/src/Illuminate/Database/Eloquent/Builder.php:521`) and applies casts, UUIDs and timestamps; reference keys are those of `node_modules/@excalidraw/excalidraw/dist/types/excalidraw/element/types.d.ts` (`boundElements`, `frameId`, `containerId`, `PointBinding.elementId`, `groupIds`).

- [ ] **Step 1: Write the failing test**

`tests/Feature/Whiteboards/CopyWhiteboardSceneTest.php`:

```php
<?php

use App\Actions\Whiteboards\CreateWhiteboard;
use App\Actions\Whiteboards\GenerateFractionalIndexes;
use App\Actions\Whiteboards\ReadWhiteboardScene;
use App\Actions\Whiteboards\SanitizeWhiteboardElement;
use App\Models\Team;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;

/**
 * @param  array<int, array<string, mixed>>  $elements
 * @param  array<int, array<string, mixed>>  $files
 * @return array{0: Whiteboard, 1: Collection<string, array<string, mixed>>}
 */
function boardFromScene(array $elements, array $files = []): array
{
    $team = Team::factory()->create();

    $board = app(CreateWhiteboard::class)->handle($team, teamMember($team), 'Copy', ['elements' => $elements, 'files' => $files]);

    return [$board, $board->elements()->orderBy('seq')->get()->map(fn (WhiteboardElement $element): array => $element->data)];
}

it('gives five thousand valid indices in the order the canvas compares them', function () {
    $indexes = app(GenerateFractionalIndexes::class)->handle(5000);
    $sorted = $indexes;
    sort($sorted, SORT_STRING);

    expect($indexes)->toBe($sorted)
        ->and(array_unique($indexes))->toHaveCount(5000)
        ->and($indexes[0])->toBe('a0')
        ->and($indexes[61])->toBe('az')
        ->and($indexes[62])->toBe('b00')
        ->and($indexes[3905])->toBe('bzz')
        ->and($indexes[3906])->toBe('c000');

    $sanitize = app(SanitizeWhiteboardElement::class);

    foreach ($indexes as $index) {
        expect($sanitize->handle(sceneElement(['index' => $index])))->not->toBeNull();
    }
});

it('copies a scene with fresh ids, the creator as author and every reference rewritten', function () {
    [$board, $copies] = boardFromScene([
        sceneElement(['id' => 'frame', 'type' => 'frame', 'name' => 'Zone', 'locked' => true, 'index' => 'a5']),
        sceneElement([
            'id' => 'box', 'frameId' => 'frame', 'groupIds' => ['group'], 'index' => 'a6',
            'boundElements' => [['id' => 'label', 'type' => 'text'], ['id' => 'link', 'type' => 'arrow']],
        ]),
        sceneElement([
            'id' => 'label', 'type' => 'text', 'text' => 'Hello', 'originalText' => 'Hello',
            'containerId' => 'box', 'frameId' => 'frame', 'groupIds' => ['group'], 'index' => 'a7',
        ]),
        sceneElement(['id' => 'target', 'type' => 'ellipse', 'boundElements' => [['id' => 'link', 'type' => 'arrow']], 'index' => 'a8']),
        sceneElement([
            'id' => 'link', 'type' => 'arrow', 'points' => [[0, 0], [50, 0]], 'index' => 'a9',
            'startBinding' => ['elementId' => 'box', 'focus' => 0, 'gap' => 4],
            'endBinding' => ['elementId' => 'target', 'focus' => 0, 'gap' => 4],
        ]),
    ]);

    [$frame, $box, $label, $target, $link] = $copies->all();
    $rows = $board->elements()->orderBy('seq')->get();
    $sanitize = app(SanitizeWhiteboardElement::class);

    expect($copies->pluck('id')->intersect(['frame', 'box', 'label', 'target', 'link'])->all())->toBe([])
        ->and($copies->pluck('id')->unique())->toHaveCount(5)
        ->and($copies->pluck('index')->all())->toBe(['a0', 'a1', 'a2', 'a3', 'a4'])
        ->and($copies->pluck('version')->unique()->all())->toBe([1])
        ->and($rows->pluck('seq')->all())->toBe([1, 2, 3, 4, 5])
        ->and($rows->pluck('author_member_id')->unique()->all())->toBe([$board->facilitator_member_id])
        ->and($rows->pluck('element_id')->all())->toBe($copies->pluck('id')->all())
        ->and($rows[4]->version_nonce)->toBe($link['versionNonce'])
        ->and($board->fresh()->seq)->toBe(5)
        ->and($frame['locked'])->toBeTrue()
        ->and($frame['name'])->toBe('Zone')
        ->and($box['frameId'])->toBe($frame['id'])
        ->and($box['boundElements'])->toBe([['id' => $label['id'], 'type' => 'text'], ['id' => $link['id'], 'type' => 'arrow']])
        ->and($label['containerId'])->toBe($box['id'])
        ->and($label['frameId'])->toBe($frame['id'])
        ->and($label['text'])->toBe('Hello')
        ->and($box['groupIds'])->toBe($label['groupIds'])
        ->and($box['groupIds'])->not->toBe(['group'])
        ->and($target['boundElements'])->toBe([['id' => $link['id'], 'type' => 'arrow']])
        ->and($link['startBinding']['elementId'])->toBe($box['id'])
        ->and($link['endBinding']['elementId'])->toBe($target['id']);

    foreach ($copies as $copy) {
        expect($sanitize->handle($copy))->toEqual($copy);
    }
});

it('drops a reference to an element that is not in the scene', function () {
    [, $copies] = boardFromScene([
        sceneElement(['id' => 'box', 'frameId' => 'gone', 'boundElements' => [['id' => 'gone', 'type' => 'arrow']]]),
        sceneElement(['id' => 'label', 'type' => 'text', 'text' => 'Alone', 'originalText' => 'Alone', 'containerId' => 'gone']),
        sceneElement([
            'id' => 'link', 'type' => 'arrow', 'points' => [[0, 0], [50, 0]],
            'startBinding' => ['elementId' => 'gone', 'focus' => 0, 'gap' => 4],
            'endBinding' => ['elementId' => 'box', 'focus' => 0, 'gap' => 4],
        ]),
        sceneElement(['id' => 'gone', 'isDeleted' => true]),
    ]);

    [$box, $label, $link] = $copies->all();

    expect($copies)->toHaveCount(3)
        ->and($box['frameId'])->toBeNull()
        ->and($box['boundElements'])->toBeNull()
        ->and($label['containerId'])->toBeNull()
        ->and($link['startBinding'])->toBeNull()
        ->and($link['endBinding']['elementId'])->toBe($box['id'])
        ->and(json_encode($copies))->not->toContain('gone');
});

it('leaves out what the board itself would refuse', function () {
    [$board, $copies] = boardFromScene([
        sceneElement(['id' => 'frame', 'type' => 'iframe']),
        'not an element',
        sceneElement(['id' => 'linked', 'link' => 'javascript:alert(1)', 'customData' => ['secret' => 'x']]),
    ]);

    expect($copies)->toHaveCount(1)
        ->and($copies[0]['link'])->toBeNull()
        ->and($copies[0])->not->toHaveKey('customData')
        ->and($board->fresh()->seq)->toBe(1);
});

it('keeps sticky notes sticky', function () {
    [$board] = boardFromScene([
        sceneElement(['id' => 'note', 'customData' => ['skrum' => ['kind' => 'sticky']]]),
        sceneElement(['id' => 'box']),
    ]);

    expect($board->elements()->orderBy('seq')->pluck('is_sticky')->all())->toBe([true, false]);
});

it('copies the images a live element shows and gives the board its own files', function () {
    Storage::fake();

    $source = Whiteboard::factory()->create();
    $shown = WhiteboardFile::factory()->create(['whiteboard_id' => $source->id, 'mime_type' => 'image/webp', 'size' => 77]);
    $unused = WhiteboardFile::factory()->create(['whiteboard_id' => $source->id]);
    Storage::put($shown->path, 'shown bytes');
    Storage::put($unused->path, 'unused bytes');

    $files = collect([$shown, $unused])->map(fn (WhiteboardFile $file): array => [
        'fileId' => $file->file_id, 'path' => $file->path, 'mimeType' => $file->mime_type, 'size' => $file->size,
    ])->all();

    [$board, $copies] = boardFromScene([
        sceneElement(['id' => 'picture', 'type' => 'image', 'fileId' => $shown->file_id, 'status' => 'saved', 'scale' => [1, 1]]),
    ], $files);

    $copy = $board->files()->sole();

    expect($copies)->toHaveCount(1)
        ->and($copies[0]['fileId'])->toBe($shown->file_id)
        ->and($copy->file_id)->toBe($shown->file_id)
        ->and($copy->path)->toBe("whiteboards/{$board->id}/{$shown->file_id}")
        ->and($copy->mime_type)->toBe('image/webp')
        ->and($copy->size)->toBe(77)
        ->and($copy->uploaded_by_member_id)->toBe($board->facilitator_member_id)
        ->and(Storage::get($copy->path))->toBe('shown bytes');

    $source->delete();

    Storage::assertExists($copy->path);
});

it('leaves out an image whose stored file is gone instead of failing', function () {
    Storage::fake();

    [$board, $copies] = boardFromScene([
        sceneElement(['id' => 'picture', 'type' => 'image', 'fileId' => 'lostfile', 'status' => 'saved', 'scale' => [1, 1]]),
        sceneElement(['id' => 'orphan', 'type' => 'image', 'fileId' => 'unlisted', 'status' => 'saved', 'scale' => [1, 1]]),
        sceneElement(['id' => 'box']),
    ], [['fileId' => 'lostfile', 'path' => 'whiteboards/none/lostfile', 'mimeType' => 'image/png', 'size' => 10]]);

    expect($copies)->toHaveCount(1)
        ->and($copies[0]['type'])->toBe('rectangle')
        ->and($board->files()->count())->toBe(0);
});

it('serves the copy in the order it was given, without touching an index', function () {
    [$board, $copies] = boardFromScene([
        sceneElement(['id' => 'back', 'index' => 'a1']),
        sceneElement(['id' => 'middle', 'index' => 'a2']),
        sceneElement(['id' => 'front', 'index' => 'a3']),
    ]);

    $this->actingAs($board->facilitator->user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertOk()
        ->assertJsonPath('seq', 3)
        ->assertJsonPath('elements', $copies->all());
});

it('reads the live scene of a board in canvas order with the files it shows', function () {
    $board = Whiteboard::factory()->create();
    $shown = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);
    WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);

    $element = fn (array $data, array $row = []) => WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id, 'element_id' => $data['id'], 'type' => $data['type'] ?? 'rectangle', 'data' => sceneElement($data), ...$row,
    ]);

    $element(['id' => 'front', 'index' => 'a2'], ['seq' => 1]);
    $element(['id' => 'back', 'index' => 'a1', 'type' => 'image', 'fileId' => $shown->file_id], ['seq' => 2]);
    $element(['id' => 'deleted', 'index' => 'a0', 'isDeleted' => true], ['seq' => 3, 'is_deleted' => true]);

    $scene = app(ReadWhiteboardScene::class)->handle($board);

    expect(array_column($scene['elements'], 'id'))->toBe(['back', 'front'])
        ->and($scene['files'])->toBe([[
            'fileId' => $shown->file_id, 'path' => $shown->path, 'mimeType' => $shown->mime_type, 'size' => $shown->size,
        ]]);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards/CopyWhiteboardSceneTest.php`
Expected: FAIL — `Class "App\Actions\Whiteboards\GenerateFractionalIndexes" not found`.

- [ ] **Step 3: Implement**

`app/Actions/Whiteboards/GenerateFractionalIndexes.php`:

```php
<?php

namespace App\Actions\Whiteboards;

/**
 * The keys the canvas itself gives the elements of a new scene, in stacking
 * order: `a0` … `az`, then `b00` … `bzz`, then `c000` …
 */
class GenerateFractionalIndexes
{
    private const Digits = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

    private const Base = 62;

    /**
     * @return list<string>
     */
    public function handle(int $count): array
    {
        $indexes = [];

        for ($position = 0; $position < $count; $position++) {
            $indexes[] = $this->at($position);
        }

        return $indexes;
    }

    private function at(int $position): string
    {
        $width = 1;

        while ($position >= self::Base ** $width) {
            $position -= self::Base ** $width;
            $width++;
        }

        $digits = '';

        for ($place = 0; $place < $width; $place++) {
            $digits = self::Digits[$position % self::Base].$digits;
            $position = intdiv($position, self::Base);
        }

        return chr(ord('a') + $width - 1).$digits;
    }
}
```

`app/Actions/Whiteboards/RemapWhiteboardScene.php`:

```php
<?php

namespace App\Actions\Whiteboards;

use Illuminate\Support\Str;

/**
 * Turns the elements of one scene into the first elements of another: fresh
 * ids, fresh stacking indices in the same order, version 1, and every
 * reference between elements rewritten. A reference to an element that is
 * not part of the scene is dropped, never copied.
 */
class RemapWhiteboardScene
{
    private const IdLength = 20;

    private const MaxNonce = 2147483647;

    private const BindingKeys = ['startBinding', 'endBinding'];

    public function __construct(private GenerateFractionalIndexes $generateFractionalIndexes) {}

    /**
     * @param  list<array<string, mixed>>  $elements  sanitized live elements, in canvas order
     * @return list<array<string, mixed>>
     */
    public function handle(array $elements): array
    {
        $ids = [];

        foreach ($elements as $element) {
            $ids[$element['id']] = Str::random(self::IdLength);
        }

        $groups = [];
        $indexes = $this->generateFractionalIndexes->handle(count($elements));
        $updated = (int) now()->getTimestampMs();
        $copies = [];

        foreach ($elements as $position => $element) {
            $copy = [
                ...$element,
                'id' => $ids[$element['id']],
                'index' => $indexes[$position],
                'version' => 1,
                'versionNonce' => random_int(1, self::MaxNonce),
                'updated' => $updated,
                'isDeleted' => false,
            ];

            foreach (['frameId', 'containerId'] as $key) {
                if (array_key_exists($key, $copy)) {
                    $copy[$key] = $ids[$copy[$key]] ?? null;
                }
            }

            foreach (self::BindingKeys as $key) {
                if (array_key_exists($key, $copy)) {
                    $copy[$key] = $this->binding($copy[$key], $ids);
                }
            }

            if (array_key_exists('boundElements', $copy)) {
                $copy['boundElements'] = $this->boundElements($copy['boundElements'], $ids);
            }

            if (array_key_exists('groupIds', $copy)) {
                $copy['groupIds'] = array_map(function (string $groupId) use (&$groups): string {
                    return $groups[$groupId] ??= Str::random(self::IdLength);
                }, $copy['groupIds']);
            }

            $copies[] = $copy;
        }

        return $copies;
    }

    /**
     * @param  array<string, string>  $ids
     * @return array<string, mixed>|null
     */
    private function binding(mixed $binding, array $ids): ?array
    {
        if (! is_array($binding) || ! isset($ids[$binding['elementId']])) {
            return null;
        }

        return [...$binding, 'elementId' => $ids[$binding['elementId']]];
    }

    /**
     * @param  array<string, string>  $ids
     * @return list<array<string, mixed>>|null
     */
    private function boundElements(mixed $boundElements, array $ids): ?array
    {
        if (! is_array($boundElements)) {
            return null;
        }

        $kept = [];

        foreach ($boundElements as $bound) {
            if (isset($ids[$bound['id']])) {
                $kept[] = [...$bound, 'id' => $ids[$bound['id']]];
            }
        }

        return $kept === [] ? null : $kept;
    }
}
```

`app/Actions/Whiteboards/CopyWhiteboardScene.php`:

```php
<?php

namespace App\Actions\Whiteboards;

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;
use Illuminate\Support\Facades\Storage;

/**
 * The one way a scene becomes the content of a new board: a built-in or
 * workspace template at creation, and the duplicate of a board. The board
 * must be new (no element, seq 0) and the caller holds the transaction.
 *
 * @phpstan-type SceneFile array{fileId: string, path: string, mimeType: string, size: int}
 * @phpstan-type Scene array{elements: list<array<string, mixed>>, files: list<SceneFile>}
 */
class CopyWhiteboardScene
{
    private const ChunkSize = 500;

    public function __construct(
        private SanitizeWhiteboardElement $sanitizeWhiteboardElement,
        private RemapWhiteboardScene $remapWhiteboardScene,
    ) {}

    /**
     * @param  Scene  $scene
     */
    public function handle(Whiteboard $board, WhiteboardMember $author, array $scene): void
    {
        $copiedFileIds = $this->copyFiles($board, $author, $scene);
        $elements = [];

        foreach ($scene['elements'] as $raw) {
            $element = $this->sanitizeWhiteboardElement->handle($raw);

            if ($element === null || $element['isDeleted']) {
                continue;
            }

            if ($element['type'] === 'image' && ! isset($copiedFileIds[$element['fileId']])) {
                continue;
            }

            $elements[] = $element;
        }

        $rows = [];

        foreach ($this->remapWhiteboardScene->handle(array_slice($elements, 0, Whiteboard::MaxLiveElements)) as $position => $element) {
            $rows[] = [
                'whiteboard_id' => $board->id,
                'element_id' => $element['id'],
                'type' => $element['type'],
                'data' => $element,
                'version' => $element['version'],
                'version_nonce' => $element['versionNonce'],
                'author_member_id' => $author->id,
                'is_sticky' => isset($element['customData']),
                'is_deleted' => false,
                'seq' => $position + 1,
            ];
        }

        foreach (array_chunk($rows, self::ChunkSize) as $chunk) {
            WhiteboardElement::query()->fillAndInsert($chunk);
        }

        $board->update(['seq' => count($rows)]);
    }

    /**
     * Only the images a live element shows are copied; one whose stored file
     * is gone is left out, and so is the element that shows it.
     *
     * @param  Scene  $scene
     * @return array<string, true>
     */
    private function copyFiles(Whiteboard $board, WhiteboardMember $author, array $scene): array
    {
        $shown = [];

        foreach ($scene['elements'] as $element) {
            if (($element['type'] ?? null) === 'image' && ! ($element['isDeleted'] ?? false) && is_string($element['fileId'] ?? null)) {
                $shown[$element['fileId']] = true;
            }
        }

        $copied = [];

        foreach ($scene['files'] as $file) {
            if (! isset($shown[$file['fileId']]) || isset($copied[$file['fileId']])) {
                continue;
            }

            if (! Storage::exists($file['path'])) {
                continue;
            }

            $path = "{$board->storageDirectory()}/{$file['fileId']}";

            Storage::copy($file['path'], $path);

            $board->files()->create([
                'file_id' => $file['fileId'],
                'path' => $path,
                'mime_type' => $file['mimeType'],
                'size' => $file['size'],
                'uploaded_by_member_id' => $author->id,
            ]);

            $copied[$file['fileId']] = true;
        }

        return $copied;
    }
}
```

`app/Actions/Whiteboards/ReadWhiteboardScene.php`:

```php
<?php

namespace App\Actions\Whiteboards;

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;

/**
 * The live scene of a board as it is stored: real text, no viewer. Nothing
 * returned here may reach a client; it only feeds a copy made on the server.
 *
 * @phpstan-import-type Scene from CopyWhiteboardScene
 */
class ReadWhiteboardScene
{
    public function __construct(private OrderWhiteboardElements $orderWhiteboardElements) {}

    /**
     * @return Scene
     */
    public function handle(Whiteboard $board): array
    {
        $elements = $this->orderWhiteboardElements
            ->handle($board->elements()->where('is_deleted', false)->get())
            ->map(fn (WhiteboardElement $element): array => $element->data)
            ->all();

        $shownFileIds = collect($elements)
            ->where('type', 'image')
            ->pluck('fileId')
            ->filter(fn (mixed $fileId): bool => is_string($fileId))
            ->unique()
            ->values();

        $files = $board->files()
            ->whereIn('file_id', $shownFileIds)
            ->orderBy('file_id')
            ->get()
            ->map(fn (WhiteboardFile $file): array => [
                'fileId' => $file->file_id,
                'path' => $file->path,
                'mimeType' => $file->mime_type,
                'size' => $file->size,
            ])
            ->all();

        return ['elements' => array_values($elements), 'files' => array_values($files)];
    }
}
```

`app/Actions/Whiteboards/CreateWhiteboard.php`:

```php
<?php

namespace App\Actions\Whiteboards;

use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * @phpstan-import-type Scene from CopyWhiteboardScene
 */
class CreateWhiteboard
{
    public function __construct(private CopyWhiteboardScene $copyWhiteboardScene) {}

    /**
     * @param  Scene  $scene
     */
    public function handle(Team $team, User $creator, string $title, array $scene = ['elements' => [], 'files' => []]): Whiteboard
    {
        return DB::transaction(function () use ($team, $creator, $title, $scene): Whiteboard {
            $board = $team->whiteboards()->create([
                'title' => $title,
                'guest_token' => Str::random(40),
            ]);

            $member = $board->members()->create(['user_id' => $creator->id]);

            $board->update(['facilitator_member_id' => $member->id]);

            $this->copyWhiteboardScene->handle($board, $member, $scene);

            return $board;
        });
    }
}
```

No broadcast is sent: nobody is on a board that is being created.

- [ ] **Step 4: Run the tests**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards`
Expected: PASS, including the existing `CreateWhiteboardTest`.

- [ ] **Step 5: Gates and commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/phpstan analyse --memory-limit=1G app/Actions/Whiteboards
git add app/Actions/Whiteboards/GenerateFractionalIndexes.php app/Actions/Whiteboards/RemapWhiteboardScene.php app/Actions/Whiteboards/CopyWhiteboardScene.php app/Actions/Whiteboards/ReadWhiteboardScene.php app/Actions/Whiteboards/CreateWhiteboard.php tests/Feature/Whiteboards/CopyWhiteboardSceneTest.php
git commit -m "feat(whiteboard): copy a scene into a new board with fresh ids and remapped references"
```

---

### Task 3: Built-in templates

**Files:**
- Create: `app/Support/WhiteboardTemplates/BuiltInTemplates.php`
- Create: `resources/whiteboard-templates/{blank,brainstorm,flowchart,user_story_map,impact_map,swot,lean_canvas,matrix}.json`
- Create: `lang/en/whiteboards.php`, `lang/fr/whiteboards.php`, `lang/de/whiteboards.php`, `lang/es/whiteboards.php`
- Modify: `app/Http/Controllers/TeamWhiteboardsController.php`
- Test: `tests/Feature/Whiteboards/BuiltInWhiteboardTemplatesTest.php`

**Interfaces:**
- Consumes: `CreateWhiteboard::handle(Team, User, string, array $scene)` (Task 2).
- Produces:
  - `BuiltInTemplates::Keys`, `BuiltInTemplates::Blank = 'blank'`, `BuiltInTemplates::keys(): list<string>`
  - `BuiltInTemplates::name(string $key): string`, `description(string $key): string`, `elements(string $key): list<array<string, mixed>>` (current locale, back to front)
  - `POST teams/{team}/whiteboards` accepts `template` (one of the keys, nullable).

File format: a JSON file lists elements back to front with only the keys that differ from the defaults in `BuiltInTemplates`. `text` and a frame's `name` hold the last segment of `whiteboards.{key}.texts.*`. A text with `containerId` is centred in its container and inherits its `frameId`; `boundElements` are derived. Frame children come before their frame (the canvas stacks a frame above its children). Text width is *estimated* (0.6 × font size per character): the canvas does not measure text it is handed (`restoreElements` only does so with `refreshDimensions`, see `dist/types/excalidraw/data/restore.d.ts`), and it draws on a surface padded by half a font size (`getCanvasPadding` in the bundle), so a slightly wrong width is harmless while a label wider than its shape is not — hence the fit test. Font family 5 and line height 1.25 are the library's defaults (`FONT_FAMILY.Excalifont`, bundle `FONT_METADATA`). Structure (frames, legend, axes) is `locked`; sample sticky notes and the starter flow are not.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Whiteboards/BuiltInWhiteboardTemplatesTest.php`:

```php
<?php

use App\Actions\Whiteboards\SanitizeWhiteboardElement;
use App\Models\Team;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Support\WhiteboardTemplates\BuiltInTemplates;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\File;

const TemplateLocales = ['en', 'fr', 'de', 'es'];

const FilledTemplates = ['brainstorm', 'flowchart', 'user_story_map', 'impact_map', 'swot', 'lean_canvas', 'matrix'];

/**
 * @return array<string, array<string, mixed>>
 */
function builtInScene(string $key, string $locale = 'en'): array
{
    app()->setLocale($locale);

    return collect(app(BuiltInTemplates::class)->elements($key))->keyBy('id')->all();
}

/**
 * The width a shape leaves to the text bound to it, as the canvas computes it.
 *
 * @param  array<string, mixed>  $container
 */
function usableTextWidth(array $container): float
{
    return match ($container['type']) {
        'ellipse' => $container['width'] * 0.7071 - 10,
        'diamond' => $container['width'] / 2 - 10,
        default => $container['width'] - 10,
    };
}

it('offers the eight templates of the spec, each with a file', function () {
    expect(BuiltInTemplates::keys())->toBe(['blank', 'brainstorm', 'flowchart', 'user_story_map', 'impact_map', 'swot', 'lean_canvas', 'matrix']);

    foreach (BuiltInTemplates::keys() as $key) {
        expect(File::exists(resource_path("whiteboard-templates/{$key}.json")))->toBeTrue();
    }

    expect(builtInScene('blank'))->toBe([]);
});

it('builds scenes the board accepts as they are', function (string $key) {
    $sanitize = app(SanitizeWhiteboardElement::class);
    $elements = app(BuiltInTemplates::class)->elements($key);

    expect(array_unique(array_column($elements, 'id')))->toHaveCount(count($elements));

    foreach ($elements as $element) {
        expect($sanitize->handle($element))->toEqual($element);
    }
})->with(BuiltInTemplates::Keys);

it('only refers to elements of the same scene, in both directions', function (string $key) {
    $scene = builtInScene($key);

    foreach ($scene as $id => $element) {
        if ($element['frameId'] !== null) {
            expect($scene[$element['frameId']]['type'])->toBe('frame');
        }

        if (($element['containerId'] ?? null) !== null) {
            expect($scene[$element['containerId']]['boundElements'])->toContain(['id' => $id, 'type' => 'text'])
                ->and($element['frameId'])->toBe($scene[$element['containerId']]['frameId']);
        }

        foreach (['startBinding', 'endBinding'] as $end) {
            if (($element[$end] ?? null) !== null) {
                expect($scene[$element[$end]['elementId']]['boundElements'])->toContain(['id' => $id, 'type' => 'arrow']);
            }
        }

        foreach ($element['boundElements'] ?? [] as $bound) {
            expect($scene)->toHaveKey($bound['id']);
        }
    }
})->with(FilledTemplates);

it('puts the children of a frame below it', function (string $key) {
    $positions = array_flip(array_keys(builtInScene($key)));

    foreach (builtInScene($key) as $id => $element) {
        if ($element['frameId'] !== null) {
            expect($positions[$id])->toBeLessThan($positions[$element['frameId']]);
        }
    }
})->with(FilledTemplates);

it('locks the structure and leaves the sample notes free', function (string $key) {
    $scene = builtInScene($key);
    $stickyIds = collect($scene)->filter(fn (array $element): bool => isset($element['customData']))->keys();

    expect(collect($scene)->where('locked', true))->not->toBeEmpty();

    foreach ($scene as $element) {
        if ($element['type'] === 'frame') {
            expect($element['locked'])->toBeTrue();
        }

        if (isset($element['customData']) || $stickyIds->contains($element['containerId'] ?? null)) {
            expect($element['locked'])->toBeFalse();
        }
    }
})->with(FilledTemplates);

it('has every template line in every locale', function (string $locale) {
    $english = array_keys(Arr::dot(require lang_path('en/whiteboards.php')));
    $translated = array_keys(Arr::dot(require lang_path("{$locale}/whiteboards.php")));

    expect(array_values(array_diff($english, $translated)))->toBe([])
        ->and(array_values(array_diff($translated, $english)))->toBe([]);
})->with(['fr', 'de', 'es']);

it('translates the name, the description and every text of a scene', function (string $key, string $locale) {
    $templates = app(BuiltInTemplates::class);
    app()->setLocale($locale);

    expect($templates->name($key))->not->toStartWith('whiteboards.')
        ->and($templates->description($key))->not->toStartWith('whiteboards.');

    foreach ($templates->elements($key) as $element) {
        $text = $element['type'] === 'frame' ? $element['name'] : ($element['text'] ?? '');

        expect($text)->not->toStartWith('whiteboards.');

        if ($element['type'] === 'text') {
            expect($element['originalText'])->toBe($element['text'])
                ->and($element['width'])->toBeGreaterThan(0)
                ->and($element['height'])->toBeGreaterThan(0);
        }
    }
})->with(BuiltInTemplates::Keys)->with(TemplateLocales);

it('keeps every label inside its shape in every locale', function (string $key, string $locale) {
    $scene = builtInScene($key, $locale);

    foreach ($scene as $element) {
        if (($element['containerId'] ?? null) === null) {
            continue;
        }

        $container = $scene[$element['containerId']];

        expect($element['width'])->toBeLessThanOrEqual(usableTextWidth($container), "{$key}/{$locale}: {$element['text']}")
            ->and($element['height'])->toBeLessThanOrEqual($container['height'] - 10)
            ->and($element['x'] + $element['width'] / 2)->toEqual($container['x'] + $container['width'] / 2)
            ->and($element['y'] + $element['height'] / 2)->toEqual($container['y'] + $container['height'] / 2);
    }
})->with(FilledTemplates)->with(TemplateLocales);

it('creates a board from a template in the language of its creator', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $user->forceFill(['locale' => 'fr'])->save();

    $this->actingAs($user)
        ->post(route('teams.whiteboards.store', [$team->workspace, $team]), ['title' => 'Analyse', 'template' => 'swot'])
        ->assertRedirect();

    $board = Whiteboard::query()->sole();
    $elements = $board->elements()->orderBy('seq')->get();
    $frames = $elements->where('type', 'frame');
    $notes = $elements->where('is_sticky', true);

    expect($frames->map(fn (WhiteboardElement $frame) => $frame->data['name'])->values()->all())
        ->toBe(['Forces', 'Faiblesses', 'Opportunités', 'Menaces'])
        ->and($frames->every(fn (WhiteboardElement $frame) => $frame->data['locked']))->toBeTrue()
        ->and($notes)->toHaveCount(4)
        ->and($notes->every(fn (WhiteboardElement $note) => ! $note->data['locked']))->toBeTrue()
        ->and($elements->firstWhere('type', 'text')->data['text'])->toBe("Que faisons-nous\nbien ?")
        ->and($elements->pluck('author_member_id')->unique()->all())->toBe([$board->facilitator_member_id])
        ->and($elements->pluck('element_id')->intersect(['strengths', 'strength-note'])->all())->toBe([])
        ->and($board->seq)->toBe($elements->count())
        ->and($elements->count())->toBe(12);
});

it('creates each template for a member and serves it back unchanged', function (string $key) {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $this->actingAs($user)
        ->post(route('teams.whiteboards.store', [$team->workspace, $team]), ['title' => 'Board', 'template' => $key])
        ->assertRedirect();

    $board = Whiteboard::query()->sole();
    $stored = $board->elements()->orderBy('seq')->get()->map(fn (WhiteboardElement $element) => $element->data)->all();

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertOk()
        ->assertJsonPath('elements', $stored);

    expect(count($stored))->toBe(count(app(BuiltInTemplates::class)->elements($key)));
})->with(BuiltInTemplates::Keys);

it('creates an empty board without a template or with the blank one', function (array $extra) {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->post(route('teams.whiteboards.store', [$team->workspace, $team]), ['title' => 'Empty', ...$extra])
        ->assertRedirect();

    expect(Whiteboard::query()->sole()->elements()->count())->toBe(0);
})->with(['no template' => [[]], 'null' => [['template' => null]], 'blank' => [['template' => 'blank']]]);

it('refuses a template that does not exist', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->post(route('teams.whiteboards.store', [$team->workspace, $team]), ['title' => 'Nope', 'template' => '../../.env'])
        ->assertSessionHasErrors('template');

    expect(Whiteboard::query()->count())->toBe(0);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards/BuiltInWhiteboardTemplatesTest.php`
Expected: FAIL — `Class "App\Support\WhiteboardTemplates\BuiltInTemplates" not found`.

- [ ] **Step 3: The expander**

`app/Support/WhiteboardTemplates/BuiltInTemplates.php`:

```php
<?php

namespace App\Support\WhiteboardTemplates;

use Illuminate\Support\Facades\File;

/**
 * The built-in scenes of `resources/whiteboard-templates`. A file lists its
 * elements back to front with only the keys that differ from the defaults
 * below; `text` and a frame's `name` hold the last segment of a line of
 * `lang/{locale}/whiteboards.php`.
 */
class BuiltInTemplates
{
    public const Blank = 'blank';

    public const Keys = ['blank', 'brainstorm', 'flowchart', 'user_story_map', 'impact_map', 'swot', 'lean_canvas', 'matrix'];

    /**
     * The canvas does not measure text it is handed, and draws it on a
     * surface of the stored size plus half a font size on each side. The
     * hand-drawn font averages about half its size per character.
     */
    public const CharacterWidth = 0.6;

    private const Base = [
        'angle' => 0,
        'strokeColor' => '#1e1e1e',
        'backgroundColor' => 'transparent',
        'fillStyle' => 'solid',
        'strokeWidth' => 2,
        'strokeStyle' => 'solid',
        'roughness' => 0,
        'opacity' => 100,
        'groupIds' => [],
        'frameId' => null,
        'index' => null,
        'roundness' => null,
        'version' => 1,
        'versionNonce' => 1,
        'isDeleted' => false,
        'boundElements' => null,
        'updated' => 1,
        'link' => null,
        'locked' => false,
    ];

    private const Linear = [
        'lastCommittedPoint' => null,
        'startBinding' => null,
        'endBinding' => null,
        'startArrowhead' => null,
        'endArrowhead' => null,
    ];

    private const ByType = [
        'text' => [
            'fontSize' => 20,
            'fontFamily' => 5,
            'textAlign' => 'left',
            'verticalAlign' => 'top',
            'containerId' => null,
            'autoResize' => true,
            'lineHeight' => 1.25,
        ],
        'arrow' => [...self::Linear, 'endArrowhead' => 'arrow', 'elbowed' => false],
        'line' => self::Linear,
        'frame' => ['name' => null],
    ];

    /**
     * @return list<string>
     */
    public static function keys(): array
    {
        return self::Keys;
    }

    public function name(string $key): string
    {
        return $this->line("whiteboards.{$key}.name");
    }

    public function description(string $key): string
    {
        return $this->line("whiteboards.{$key}.description");
    }

    /**
     * The scene in the current locale, back to front.
     *
     * @return list<array<string, mixed>>
     */
    public function elements(string $key): array
    {
        $elements = [];

        foreach ($this->read($key) as $raw) {
            $elements[$raw['id']] = [
                ...self::Base,
                ...(self::ByType[$raw['type']] ?? []),
                'seed' => crc32("{$key}:{$raw['id']}") % 2147483647,
                ...$raw,
            ];
        }

        foreach ($elements as $id => $element) {
            $elements[$id] = match ($element['type']) {
                'text' => $this->text($key, $element, $elements[$element['containerId']] ?? null),
                'frame' => [...$element, 'name' => $this->line("whiteboards.{$key}.texts.{$element['name']}")],
                'arrow', 'line' => [...$element, ...$this->extent($element['points'])],
                default => $element,
            };
        }

        foreach ($elements as $id => $element) {
            if (($element['containerId'] ?? null) !== null) {
                $elements[$element['containerId']]['boundElements'][] = ['id' => $id, 'type' => 'text'];
            }

            foreach (['startBinding', 'endBinding'] as $end) {
                if (($element[$end] ?? null) !== null) {
                    $elements[$element[$end]['elementId']]['boundElements'][] = ['id' => $id, 'type' => 'arrow'];
                }
            }
        }

        return array_values($elements);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function read(string $key): array
    {
        abort_unless(in_array($key, self::Keys, true), 404);

        /** @var array{elements: list<array<string, mixed>>} $scene */
        $scene = json_decode(File::get(resource_path("whiteboard-templates/{$key}.json")), true, flags: JSON_THROW_ON_ERROR);

        return $scene['elements'];
    }

    /**
     * A text in a shape is centred in it and belongs to the shape's frame.
     *
     * @param  array<string, mixed>  $element
     * @param  array<string, mixed>|null  $container
     * @return array<string, mixed>
     */
    private function text(string $key, array $element, ?array $container): array
    {
        $text = $this->line("whiteboards.{$key}.texts.{$element['text']}");
        $lines = explode("\n", $text);
        $width = (int) ceil(max(array_map(mb_strlen(...), $lines)) * $element['fontSize'] * self::CharacterWidth);
        $height = (int) ceil(count($lines) * $element['fontSize'] * $element['lineHeight']);

        $element = [...$element, 'text' => $text, 'originalText' => $text, 'width' => $width, 'height' => $height];

        if ($container === null) {
            return $element;
        }

        return [
            ...$element,
            'x' => $container['x'] + ($container['width'] - $width) / 2,
            'y' => $container['y'] + ($container['height'] - $height) / 2,
            'textAlign' => 'center',
            'verticalAlign' => 'middle',
            'frameId' => $container['frameId'],
        ];
    }

    /**
     * @param  non-empty-list<array{0: int|float, 1: int|float}>  $points
     * @return array{width: int|float, height: int|float}
     */
    private function extent(array $points): array
    {
        $xs = array_column($points, 0);
        $ys = array_column($points, 1);

        return ['width' => max($xs) - min($xs), 'height' => max($ys) - min($ys)];
    }

    private function line(string $key): string
    {
        $line = __($key);

        return is_string($line) ? $line : $key;
    }
}
```

- [ ] **Step 4: The eight scenes**

`resources/whiteboard-templates/blank.json`:

```json
{
    "elements": []
}
```
`resources/whiteboard-templates/brainstorm.json`:

```json
{
    "elements": [
        {"id": "question-note", "type": "rectangle", "x": 520, "y": 40, "width": 200, "height": 200, "strokeColor": "transparent", "backgroundColor": "#a5d8ff", "strokeWidth": 1, "frameId": "question", "customData": {"skrum": {"kind": "sticky"}}},
        {"id": "question-note-text", "type": "text", "fontSize": 16, "containerId": "question-note", "text": "question_note"},
        {"id": "question", "type": "frame", "x": 0, "y": 0, "width": 1240, "height": 280, "name": "question", "locked": true},
        {"id": "idea-note", "type": "rectangle", "x": 40, "y": 380, "width": 200, "height": 200, "strokeColor": "transparent", "backgroundColor": "#fff3bf", "strokeWidth": 1, "frameId": "ideas", "customData": {"skrum": {"kind": "sticky"}}},
        {"id": "idea-note-text", "type": "text", "fontSize": 16, "containerId": "idea-note", "text": "idea_note"},
        {"id": "build-note", "type": "rectangle", "x": 280, "y": 380, "width": 200, "height": 200, "strokeColor": "transparent", "backgroundColor": "#fff3bf", "strokeWidth": 1, "frameId": "ideas", "customData": {"skrum": {"kind": "sticky"}}},
        {"id": "build-note-text", "type": "text", "fontSize": 16, "containerId": "build-note", "text": "build_note"},
        {"id": "ideas", "type": "frame", "x": 0, "y": 340, "width": 800, "height": 640, "name": "ideas", "locked": true},
        {"id": "top-picks", "type": "frame", "x": 840, "y": 340, "width": 400, "height": 640, "name": "top_picks", "locked": true}
    ]
}
```
`resources/whiteboard-templates/flowchart.json`:

```json
{
    "elements": [
        {"id": "legend-terminal", "type": "ellipse", "x": 70, "y": 50, "width": 200, "height": 80, "frameId": "legend", "locked": true},
        {"id": "legend-terminal-text", "type": "text", "fontSize": 16, "containerId": "legend-terminal", "text": "legend_terminal", "locked": true},
        {"id": "legend-step", "type": "rectangle", "x": 70, "y": 170, "width": 200, "height": 80, "frameId": "legend", "locked": true},
        {"id": "legend-step-text", "type": "text", "fontSize": 16, "containerId": "legend-step", "text": "legend_step", "locked": true},
        {"id": "legend-decision", "type": "diamond", "x": 30, "y": 290, "width": 280, "height": 140, "frameId": "legend", "locked": true},
        {"id": "legend-decision-text", "type": "text", "fontSize": 16, "containerId": "legend-decision", "text": "legend_decision", "locked": true},
        {"id": "legend", "type": "frame", "x": 0, "y": 0, "width": 340, "height": 470, "name": "legend", "locked": true},
        {"id": "start", "type": "ellipse", "x": 520, "y": 0, "width": 200, "height": 80, "backgroundColor": "#b2f2bb"},
        {"id": "start-text", "type": "text", "fontSize": 16, "containerId": "start", "text": "start"},
        {"id": "first-step", "type": "rectangle", "x": 520, "y": 160, "width": 200, "height": 80, "backgroundColor": "#a5d8ff"},
        {"id": "first-step-text", "type": "text", "fontSize": 16, "containerId": "first-step", "text": "first_step"},
        {"id": "decision", "type": "diamond", "x": 480, "y": 320, "width": 280, "height": 140, "backgroundColor": "#fff3bf"},
        {"id": "decision-text", "type": "text", "fontSize": 16, "containerId": "decision", "text": "decision"},
        {"id": "next-step", "type": "rectangle", "x": 520, "y": 540, "width": 200, "height": 80, "backgroundColor": "#a5d8ff"},
        {"id": "next-step-text", "type": "text", "fontSize": 16, "containerId": "next-step", "text": "next_step"},
        {"id": "other-path", "type": "rectangle", "x": 880, "y": 350, "width": 200, "height": 80, "backgroundColor": "#a5d8ff"},
        {"id": "other-path-text", "type": "text", "fontSize": 16, "containerId": "other-path", "text": "other_path"},
        {"id": "end", "type": "ellipse", "x": 520, "y": 700, "width": 200, "height": 80, "backgroundColor": "#ffc9c9"},
        {"id": "end-text", "type": "text", "fontSize": 16, "containerId": "end", "text": "end"},
        {"id": "start-to-first", "type": "arrow", "x": 620, "y": 88, "points": [[0, 0], [0, 64]], "startBinding": {"elementId": "start", "focus": 0, "gap": 8}, "endBinding": {"elementId": "first-step", "focus": 0, "gap": 8}},
        {"id": "first-to-decision", "type": "arrow", "x": 620, "y": 248, "points": [[0, 0], [0, 64]], "startBinding": {"elementId": "first-step", "focus": 0, "gap": 8}, "endBinding": {"elementId": "decision", "focus": 0, "gap": 8}},
        {"id": "decision-to-next", "type": "arrow", "x": 620, "y": 468, "points": [[0, 0], [0, 64]], "startBinding": {"elementId": "decision", "focus": 0, "gap": 8}, "endBinding": {"elementId": "next-step", "focus": 0, "gap": 8}},
        {"id": "decision-to-other", "type": "arrow", "x": 768, "y": 390, "points": [[0, 0], [104, 0]], "startBinding": {"elementId": "decision", "focus": 0, "gap": 8}, "endBinding": {"elementId": "other-path", "focus": 0, "gap": 8}},
        {"id": "next-to-end", "type": "arrow", "x": 620, "y": 628, "points": [[0, 0], [0, 64]], "startBinding": {"elementId": "next-step", "focus": 0, "gap": 8}, "endBinding": {"elementId": "end", "focus": 0, "gap": 8}},
        {"id": "yes", "type": "text", "fontSize": 16, "x": 636, "y": 488, "text": "yes"},
        {"id": "no", "type": "text", "fontSize": 16, "x": 800, "y": 360, "text": "no"}
    ]
}
```
`resources/whiteboard-templates/user_story_map.json`:

```json
{
    "elements": [
        {"id": "activity-note", "type": "rectangle", "x": 40, "y": 40, "width": 200, "height": 200, "strokeColor": "transparent", "backgroundColor": "#a5d8ff", "strokeWidth": 1, "frameId": "activities", "customData": {"skrum": {"kind": "sticky"}}},
        {"id": "activity-note-text", "type": "text", "fontSize": 16, "containerId": "activity-note", "text": "activity_note"},
        {"id": "activities", "type": "frame", "x": 0, "y": 0, "width": 1400, "height": 280, "name": "activities", "locked": true},
        {"id": "step-note", "type": "rectangle", "x": 40, "y": 380, "width": 200, "height": 200, "strokeColor": "transparent", "backgroundColor": "#fff3bf", "strokeWidth": 1, "frameId": "steps", "customData": {"skrum": {"kind": "sticky"}}},
        {"id": "step-note-text", "type": "text", "fontSize": 16, "containerId": "step-note", "text": "step_note"},
        {"id": "steps", "type": "frame", "x": 0, "y": 340, "width": 1400, "height": 280, "name": "steps", "locked": true},
        {"id": "story-note", "type": "rectangle", "x": 40, "y": 720, "width": 200, "height": 200, "strokeColor": "transparent", "backgroundColor": "#b2f2bb", "strokeWidth": 1, "frameId": "stories", "customData": {"skrum": {"kind": "sticky"}}},
        {"id": "story-note-text", "type": "text", "fontSize": 16, "containerId": "story-note", "text": "story_note"},
        {"id": "stories", "type": "frame", "x": 0, "y": 680, "width": 1400, "height": 560, "name": "stories", "locked": true}
    ]
}
```
`resources/whiteboard-templates/impact_map.json`:

```json
{
    "elements": [
        {"id": "goal-note", "type": "rectangle", "x": 50, "y": 60, "width": 200, "height": 200, "strokeColor": "transparent", "backgroundColor": "#d0bfff", "strokeWidth": 1, "frameId": "goal", "customData": {"skrum": {"kind": "sticky"}}},
        {"id": "goal-note-text", "type": "text", "fontSize": 16, "containerId": "goal-note", "text": "goal_note"},
        {"id": "goal", "type": "frame", "x": 0, "y": 0, "width": 300, "height": 800, "name": "goal", "locked": true},
        {"id": "actor-note", "type": "rectangle", "x": 390, "y": 60, "width": 200, "height": 200, "strokeColor": "transparent", "backgroundColor": "#a5d8ff", "strokeWidth": 1, "frameId": "actors", "customData": {"skrum": {"kind": "sticky"}}},
        {"id": "actor-note-text", "type": "text", "fontSize": 16, "containerId": "actor-note", "text": "actor_note"},
        {"id": "actors", "type": "frame", "x": 340, "y": 0, "width": 300, "height": 800, "name": "actors", "locked": true},
        {"id": "impact-note", "type": "rectangle", "x": 730, "y": 60, "width": 200, "height": 200, "strokeColor": "transparent", "backgroundColor": "#fff3bf", "strokeWidth": 1, "frameId": "impacts", "customData": {"skrum": {"kind": "sticky"}}},
        {"id": "impact-note-text", "type": "text", "fontSize": 16, "containerId": "impact-note", "text": "impact_note"},
        {"id": "impacts", "type": "frame", "x": 680, "y": 0, "width": 300, "height": 800, "name": "impacts", "locked": true},
        {"id": "deliverable-note", "type": "rectangle", "x": 1070, "y": 60, "width": 200, "height": 200, "strokeColor": "transparent", "backgroundColor": "#b2f2bb", "strokeWidth": 1, "frameId": "deliverables", "customData": {"skrum": {"kind": "sticky"}}},
        {"id": "deliverable-note-text", "type": "text", "fontSize": 16, "containerId": "deliverable-note", "text": "deliverable_note"},
        {"id": "deliverables", "type": "frame", "x": 1020, "y": 0, "width": 300, "height": 800, "name": "deliverables", "locked": true},
        {"id": "goal-to-actor", "type": "arrow", "x": 258, "y": 160, "points": [[0, 0], [124, 0]], "startBinding": {"elementId": "goal-note", "focus": 0, "gap": 8}, "endBinding": {"elementId": "actor-note", "focus": 0, "gap": 8}},
        {"id": "actor-to-impact", "type": "arrow", "x": 598, "y": 160, "points": [[0, 0], [124, 0]], "startBinding": {"elementId": "actor-note", "focus": 0, "gap": 8}, "endBinding": {"elementId": "impact-note", "focus": 0, "gap": 8}},
        {"id": "impact-to-deliverable", "type": "arrow", "x": 938, "y": 160, "points": [[0, 0], [124, 0]], "startBinding": {"elementId": "impact-note", "focus": 0, "gap": 8}, "endBinding": {"elementId": "deliverable-note", "focus": 0, "gap": 8}}
    ]
}
```
`resources/whiteboard-templates/swot.json`:

```json
{
    "elements": [
        {"id": "strength-note", "type": "rectangle", "x": 40, "y": 40, "width": 200, "height": 200, "strokeColor": "transparent", "backgroundColor": "#b2f2bb", "strokeWidth": 1, "frameId": "strengths", "customData": {"skrum": {"kind": "sticky"}}},
        {"id": "strength-note-text", "type": "text", "fontSize": 16, "containerId": "strength-note", "text": "strength_note"},
        {"id": "strengths", "type": "frame", "x": 0, "y": 0, "width": 600, "height": 400, "name": "strengths", "locked": true},
        {"id": "weakness-note", "type": "rectangle", "x": 680, "y": 40, "width": 200, "height": 200, "strokeColor": "transparent", "backgroundColor": "#ffc9c9", "strokeWidth": 1, "frameId": "weaknesses", "customData": {"skrum": {"kind": "sticky"}}},
        {"id": "weakness-note-text", "type": "text", "fontSize": 16, "containerId": "weakness-note", "text": "weakness_note"},
        {"id": "weaknesses", "type": "frame", "x": 640, "y": 0, "width": 600, "height": 400, "name": "weaknesses", "locked": true},
        {"id": "opportunity-note", "type": "rectangle", "x": 40, "y": 500, "width": 200, "height": 200, "strokeColor": "transparent", "backgroundColor": "#a5d8ff", "strokeWidth": 1, "frameId": "opportunities", "customData": {"skrum": {"kind": "sticky"}}},
        {"id": "opportunity-note-text", "type": "text", "fontSize": 16, "containerId": "opportunity-note", "text": "opportunity_note"},
        {"id": "opportunities", "type": "frame", "x": 0, "y": 460, "width": 600, "height": 400, "name": "opportunities", "locked": true},
        {"id": "threat-note", "type": "rectangle", "x": 680, "y": 500, "width": 200, "height": 200, "strokeColor": "transparent", "backgroundColor": "#ffd8a8", "strokeWidth": 1, "frameId": "threats", "customData": {"skrum": {"kind": "sticky"}}},
        {"id": "threat-note-text", "type": "text", "fontSize": 16, "containerId": "threat-note", "text": "threat_note"},
        {"id": "threats", "type": "frame", "x": 640, "y": 460, "width": 600, "height": 400, "name": "threats", "locked": true}
    ]
}
```
`resources/whiteboard-templates/lean_canvas.json`:

```json
{
    "elements": [
        {"id": "problem-note", "type": "rectangle", "x": 50, "y": 40, "width": 200, "height": 200, "strokeColor": "transparent", "backgroundColor": "#ffc9c9", "strokeWidth": 1, "frameId": "problem", "customData": {"skrum": {"kind": "sticky"}}},
        {"id": "problem-note-text", "type": "text", "fontSize": 16, "containerId": "problem-note", "text": "problem_note"},
        {"id": "problem", "type": "frame", "x": 0, "y": 0, "width": 300, "height": 640, "name": "problem", "locked": true},
        {"id": "solution", "type": "frame", "x": 340, "y": 0, "width": 300, "height": 290, "name": "solution", "locked": true},
        {"id": "key-metrics", "type": "frame", "x": 340, "y": 350, "width": 300, "height": 290, "name": "key_metrics", "locked": true},
        {"id": "value-proposition", "type": "frame", "x": 680, "y": 0, "width": 300, "height": 640, "name": "value_proposition", "locked": true},
        {"id": "unfair-advantage", "type": "frame", "x": 1020, "y": 0, "width": 300, "height": 290, "name": "unfair_advantage", "locked": true},
        {"id": "channels", "type": "frame", "x": 1020, "y": 350, "width": 300, "height": 290, "name": "channels", "locked": true},
        {"id": "customer-segments", "type": "frame", "x": 1360, "y": 0, "width": 300, "height": 640, "name": "customer_segments", "locked": true},
        {"id": "cost-structure", "type": "frame", "x": 0, "y": 700, "width": 810, "height": 280, "name": "cost_structure", "locked": true},
        {"id": "revenue-streams", "type": "frame", "x": 850, "y": 700, "width": 810, "height": 280, "name": "revenue_streams", "locked": true}
    ]
}
```
`resources/whiteboard-templates/matrix.json`:

```json
{
    "elements": [
        {"id": "quick-win-note", "type": "rectangle", "x": 140, "y": 40, "width": 200, "height": 200, "strokeColor": "transparent", "backgroundColor": "#b2f2bb", "strokeWidth": 1, "frameId": "quick-wins", "customData": {"skrum": {"kind": "sticky"}}},
        {"id": "quick-win-note-text", "type": "text", "fontSize": 16, "containerId": "quick-win-note", "text": "quick_win_note"},
        {"id": "quick-wins", "type": "frame", "x": 100, "y": 0, "width": 500, "height": 400, "name": "quick_wins", "locked": true},
        {"id": "big-bets", "type": "frame", "x": 640, "y": 0, "width": 500, "height": 400, "name": "big_bets", "locked": true},
        {"id": "fill-ins", "type": "frame", "x": 100, "y": 460, "width": 500, "height": 400, "name": "fill_ins", "locked": true},
        {"id": "time-sinks", "type": "frame", "x": 640, "y": 460, "width": 500, "height": 400, "name": "time_sinks", "locked": true},
        {"id": "impact-axis", "type": "arrow", "x": 60, "y": 860, "points": [[0, 0], [0, -860]], "locked": true},
        {"id": "effort-axis", "type": "arrow", "x": 100, "y": 900, "points": [[0, 0], [1040, 0]], "locked": true},
        {"id": "impact", "type": "text", "x": 0, "y": -80, "text": "impact", "locked": true},
        {"id": "effort", "type": "text", "x": 1040, "y": 920, "text": "effort", "locked": true}
    ]
}
```

- [ ] **Step 5: The four translation files**

`lang/en/whiteboards.php`:

```php
<?php

return [
    'blank' => [
        'name' => 'Blank',
        'description' => 'An empty canvas.',
    ],
    'brainstorm' => [
        'name' => 'Brainstorm',
        'description' => 'A question, a space for ideas and a place for the best ones.',
        'texts' => [
            'question' => 'Question',
            'ideas' => 'Ideas',
            'top_picks' => 'Top picks',
            'question_note' => "What problem\nare we solving?",
            'idea_note' => "One idea\nper note",
            'build_note' => "Build on\nothers' ideas",
        ],
    ],
    'flowchart' => [
        'name' => 'Flowchart',
        'description' => 'A starter flow with steps and a decision.',
        'texts' => [
            'legend' => 'Legend',
            'legend_terminal' => 'Start / End',
            'legend_step' => 'Step',
            'legend_decision' => 'Decision',
            'start' => 'Start',
            'first_step' => 'First step',
            'decision' => 'Decision?',
            'next_step' => 'Next step',
            'other_path' => 'Other path',
            'end' => 'End',
            'yes' => 'Yes',
            'no' => 'No',
        ],
    ],
    'user_story_map' => [
        'name' => 'User story map',
        'description' => 'Activities, steps and stories laid out in rows.',
        'texts' => [
            'activities' => 'Activities',
            'steps' => 'Steps',
            'stories' => 'Stories',
            'activity_note' => "What the\nuser does",
            'step_note' => "A step of\nthe activity",
            'story_note' => "A story that\ndelivers the step",
        ],
    ],
    'impact_map' => [
        'name' => 'Impact map',
        'description' => 'From the goal to the actors, impacts and deliverables.',
        'texts' => [
            'goal' => 'Goal',
            'actors' => 'Actors',
            'impacts' => 'Impacts',
            'deliverables' => 'Deliverables',
            'goal_note' => "Why are we\ndoing this?",
            'actor_note' => "Who can help\nor hinder?",
            'impact_note' => "How should their\nbehaviour change?",
            'deliverable_note' => "What can\nwe deliver?",
        ],
    ],
    'swot' => [
        'name' => 'SWOT',
        'description' => 'Strengths, weaknesses, opportunities and threats.',
        'texts' => [
            'strengths' => 'Strengths',
            'weaknesses' => 'Weaknesses',
            'opportunities' => 'Opportunities',
            'threats' => 'Threats',
            'strength_note' => "What do we\ndo well?",
            'weakness_note' => "Where do we\nstruggle?",
            'opportunity_note' => "What could\nwe seize?",
            'threat_note' => "What could\nhurt us?",
        ],
    ],
    'lean_canvas' => [
        'name' => 'Lean canvas',
        'description' => 'A one-page business model in nine blocks.',
        'texts' => [
            'problem' => 'Problem',
            'solution' => 'Solution',
            'key_metrics' => 'Key metrics',
            'value_proposition' => 'Unique value proposition',
            'unfair_advantage' => 'Unfair advantage',
            'channels' => 'Channels',
            'customer_segments' => 'Customer segments',
            'cost_structure' => 'Cost structure',
            'revenue_streams' => 'Revenue streams',
            'problem_note' => "Top three\nproblems",
        ],
    ],
    'matrix' => [
        'name' => '2×2 matrix',
        'description' => 'Sort ideas by impact and effort.',
        'texts' => [
            'quick_wins' => 'Quick wins',
            'big_bets' => 'Big bets',
            'fill_ins' => 'Fill-ins',
            'time_sinks' => 'Time sinks',
            'impact' => 'Impact',
            'effort' => 'Effort',
            'quick_win_note' => "Small effort,\nbig impact",
        ],
    ],
];
```
`lang/fr/whiteboards.php`:

```php
<?php

return [
    'blank' => [
        'name' => 'Vierge',
        'description' => 'Un canevas vide.',
    ],
    'brainstorm' => [
        'name' => 'Brainstorming',
        'description' => 'Une question, un espace pour les idées et un autre pour les meilleures.',
        'texts' => [
            'question' => 'Question',
            'ideas' => 'Idées',
            'top_picks' => 'Sélection',
            'question_note' => "Quel problème\nvoulons-nous\nrésoudre ?",
            'idea_note' => "Une idée\npar post-it",
            'build_note' => "Rebondissez sur\nles autres idées",
        ],
    ],
    'flowchart' => [
        'name' => 'Logigramme',
        'description' => 'Un flux de départ avec des étapes et une décision.',
        'texts' => [
            'legend' => 'Légende',
            'legend_terminal' => 'Début / Fin',
            'legend_step' => 'Étape',
            'legend_decision' => 'Décision',
            'start' => 'Début',
            'first_step' => 'Première étape',
            'decision' => 'Décision ?',
            'next_step' => 'Étape suivante',
            'other_path' => 'Autre chemin',
            'end' => 'Fin',
            'yes' => 'Oui',
            'no' => 'Non',
        ],
    ],
    'user_story_map' => [
        'name' => 'Carte des récits utilisateur',
        'description' => 'Activités, étapes et récits disposés en lignes.',
        'texts' => [
            'activities' => 'Activités',
            'steps' => 'Étapes',
            'stories' => 'Récits',
            'activity_note' => "Ce que fait\nl'utilisateur",
            'step_note' => "Une étape de\nl'activité",
            'story_note' => "Un récit qui\nréalise l'étape",
        ],
    ],
    'impact_map' => [
        'name' => "Carte d'impact",
        'description' => "De l'objectif aux acteurs, aux impacts et aux livrables.",
        'texts' => [
            'goal' => 'Objectif',
            'actors' => 'Acteurs',
            'impacts' => 'Impacts',
            'deliverables' => 'Livrables',
            'goal_note' => "Pourquoi\nfaisons-nous cela ?",
            'actor_note' => "Qui peut aider\nou freiner ?",
            'impact_note' => "Quel changement\nde comportement ?",
            'deliverable_note' => "Que pouvons-nous\nlivrer ?",
        ],
    ],
    'swot' => [
        'name' => 'SWOT',
        'description' => 'Forces, faiblesses, opportunités et menaces.',
        'texts' => [
            'strengths' => 'Forces',
            'weaknesses' => 'Faiblesses',
            'opportunities' => 'Opportunités',
            'threats' => 'Menaces',
            'strength_note' => "Que faisons-nous\nbien ?",
            'weakness_note' => "Où avons-nous\ndu mal ?",
            'opportunity_note' => "Que pourrions-nous\nsaisir ?",
            'threat_note' => "Qu'est-ce qui\nnous menace ?",
        ],
    ],
    'lean_canvas' => [
        'name' => 'Lean canvas',
        'description' => 'Un modèle économique en une page et neuf blocs.',
        'texts' => [
            'problem' => 'Problème',
            'solution' => 'Solution',
            'key_metrics' => 'Indicateurs clés',
            'value_proposition' => 'Proposition de valeur unique',
            'unfair_advantage' => 'Avantage déloyal',
            'channels' => 'Canaux',
            'customer_segments' => 'Segments de clientèle',
            'cost_structure' => 'Structure de coûts',
            'revenue_streams' => 'Sources de revenus',
            'problem_note' => "Les trois plus\ngros problèmes",
        ],
    ],
    'matrix' => [
        'name' => 'Matrice 2×2',
        'description' => "Triez les idées selon l'impact et l'effort.",
        'texts' => [
            'quick_wins' => 'Gains rapides',
            'big_bets' => 'Gros paris',
            'fill_ins' => 'Compléments',
            'time_sinks' => 'Pertes de temps',
            'impact' => 'Impact',
            'effort' => 'Effort',
            'quick_win_note' => "Petit effort,\ngrand impact",
        ],
    ],
];
```
`lang/de/whiteboards.php`:

```php
<?php

return [
    'blank' => [
        'name' => 'Leer',
        'description' => 'Eine leere Zeichenfläche.',
    ],
    'brainstorm' => [
        'name' => 'Brainstorming',
        'description' => 'Eine Frage, Platz für Ideen und ein Bereich für die besten.',
        'texts' => [
            'question' => 'Frage',
            'ideas' => 'Ideen',
            'top_picks' => 'Favoriten',
            'question_note' => "Welches Problem\nlösen wir?",
            'idea_note' => "Eine Idee\npro Notiz",
            'build_note' => "Auf Ideen anderer\naufbauen",
        ],
    ],
    'flowchart' => [
        'name' => 'Flussdiagramm',
        'description' => 'Ein Ablauf zum Einstieg mit Schritten und einer Entscheidung.',
        'texts' => [
            'legend' => 'Legende',
            'legend_terminal' => 'Start / Ende',
            'legend_step' => 'Schritt',
            'legend_decision' => 'Entscheidung',
            'start' => 'Start',
            'first_step' => 'Erster Schritt',
            'decision' => 'Entscheidung?',
            'next_step' => 'Nächster Schritt',
            'other_path' => 'Anderer Weg',
            'end' => 'Ende',
            'yes' => 'Ja',
            'no' => 'Nein',
        ],
    ],
    'user_story_map' => [
        'name' => 'User-Story-Map',
        'description' => 'Aktivitäten, Schritte und Storys in Zeilen angeordnet.',
        'texts' => [
            'activities' => 'Aktivitäten',
            'steps' => 'Schritte',
            'stories' => 'Storys',
            'activity_note' => "Was die Person\ntut",
            'step_note' => "Ein Schritt der\nAktivität",
            'story_note' => "Eine Story, die den\nSchritt umsetzt",
        ],
    ],
    'impact_map' => [
        'name' => 'Impact-Map',
        'description' => 'Vom Ziel zu Akteuren, Wirkungen und Ergebnissen.',
        'texts' => [
            'goal' => 'Ziel',
            'actors' => 'Akteure',
            'impacts' => 'Wirkungen',
            'deliverables' => 'Ergebnisse',
            'goal_note' => "Warum tun\nwir das?",
            'actor_note' => "Wer kann helfen\noder bremsen?",
            'impact_note' => "Wie soll sich ihr\nVerhalten ändern?",
            'deliverable_note' => "Was können\nwir liefern?",
        ],
    ],
    'swot' => [
        'name' => 'SWOT',
        'description' => 'Stärken, Schwächen, Chancen und Risiken.',
        'texts' => [
            'strengths' => 'Stärken',
            'weaknesses' => 'Schwächen',
            'opportunities' => 'Chancen',
            'threats' => 'Risiken',
            'strength_note' => "Was machen\nwir gut?",
            'weakness_note' => "Wo tun wir\nuns schwer?",
            'opportunity_note' => "Was könnten\nwir nutzen?",
            'threat_note' => "Was könnte\nuns schaden?",
        ],
    ],
    'lean_canvas' => [
        'name' => 'Lean Canvas',
        'description' => 'Ein Geschäftsmodell auf einer Seite in neun Feldern.',
        'texts' => [
            'problem' => 'Problem',
            'solution' => 'Lösung',
            'key_metrics' => 'Kennzahlen',
            'value_proposition' => 'Einzigartiges Wertversprechen',
            'unfair_advantage' => 'Unfairer Vorteil',
            'channels' => 'Kanäle',
            'customer_segments' => 'Kundensegmente',
            'cost_structure' => 'Kostenstruktur',
            'revenue_streams' => 'Einnahmequellen',
            'problem_note' => "Die drei größten\nProbleme",
        ],
    ],
    'matrix' => [
        'name' => '2×2-Matrix',
        'description' => 'Ideen nach Wirkung und Aufwand sortieren.',
        'texts' => [
            'quick_wins' => 'Schnelle Erfolge',
            'big_bets' => 'Große Wetten',
            'fill_ins' => 'Lückenfüller',
            'time_sinks' => 'Zeitfresser',
            'impact' => 'Wirkung',
            'effort' => 'Aufwand',
            'quick_win_note' => "Wenig Aufwand,\ngroße Wirkung",
        ],
    ],
];
```
`lang/es/whiteboards.php`:

```php
<?php

return [
    'blank' => [
        'name' => 'En blanco',
        'description' => 'Un lienzo vacío.',
    ],
    'brainstorm' => [
        'name' => 'Lluvia de ideas',
        'description' => 'Una pregunta, un espacio para ideas y otro para las mejores.',
        'texts' => [
            'question' => 'Pregunta',
            'ideas' => 'Ideas',
            'top_picks' => 'Favoritas',
            'question_note' => "¿Qué problema\nresolvemos?",
            'idea_note' => "Una idea\npor nota",
            'build_note' => "Construye sobre\nlas ideas de otros",
        ],
    ],
    'flowchart' => [
        'name' => 'Diagrama de flujo',
        'description' => 'Un flujo inicial con pasos y una decisión.',
        'texts' => [
            'legend' => 'Leyenda',
            'legend_terminal' => 'Inicio / Fin',
            'legend_step' => 'Paso',
            'legend_decision' => 'Decisión',
            'start' => 'Inicio',
            'first_step' => 'Primer paso',
            'decision' => '¿Decisión?',
            'next_step' => 'Siguiente paso',
            'other_path' => 'Otro camino',
            'end' => 'Fin',
            'yes' => 'Sí',
            'no' => 'No',
        ],
    ],
    'user_story_map' => [
        'name' => 'Mapa de historias de usuario',
        'description' => 'Actividades, pasos e historias dispuestos en filas.',
        'texts' => [
            'activities' => 'Actividades',
            'steps' => 'Pasos',
            'stories' => 'Historias',
            'activity_note' => "Lo que hace\nla persona",
            'step_note' => "Un paso de\nla actividad",
            'story_note' => "Una historia que\nentrega el paso",
        ],
    ],
    'impact_map' => [
        'name' => 'Mapa de impacto',
        'description' => 'Del objetivo a los actores, los impactos y los entregables.',
        'texts' => [
            'goal' => 'Objetivo',
            'actors' => 'Actores',
            'impacts' => 'Impactos',
            'deliverables' => 'Entregables',
            'goal_note' => "¿Por qué\nhacemos esto?",
            'actor_note' => "¿Quién puede ayudar\no frenar?",
            'impact_note' => "¿Cómo debe cambiar\nsu conducta?",
            'deliverable_note' => "¿Qué podemos\nentregar?",
        ],
    ],
    'swot' => [
        'name' => 'DAFO',
        'description' => 'Fortalezas, debilidades, oportunidades y amenazas.',
        'texts' => [
            'strengths' => 'Fortalezas',
            'weaknesses' => 'Debilidades',
            'opportunities' => 'Oportunidades',
            'threats' => 'Amenazas',
            'strength_note' => "¿Qué hacemos\nbien?",
            'weakness_note' => "¿Dónde nos\ncuesta?",
            'opportunity_note' => "¿Qué podríamos\naprovechar?",
            'threat_note' => "¿Qué podría\nperjudicarnos?",
        ],
    ],
    'lean_canvas' => [
        'name' => 'Lean canvas',
        'description' => 'Un modelo de negocio en una página y nueve bloques.',
        'texts' => [
            'problem' => 'Problema',
            'solution' => 'Solución',
            'key_metrics' => 'Métricas clave',
            'value_proposition' => 'Propuesta de valor única',
            'unfair_advantage' => 'Ventaja injusta',
            'channels' => 'Canales',
            'customer_segments' => 'Segmentos de clientes',
            'cost_structure' => 'Estructura de costes',
            'revenue_streams' => 'Fuentes de ingresos',
            'problem_note' => "Los tres mayores\nproblemas",
        ],
    ],
    'matrix' => [
        'name' => 'Matriz 2×2',
        'description' => 'Ordena las ideas por impacto y esfuerzo.',
        'texts' => [
            'quick_wins' => 'Victorias rápidas',
            'big_bets' => 'Grandes apuestas',
            'fill_ins' => 'Relleno',
            'time_sinks' => 'Pérdidas de tiempo',
            'impact' => 'Impacto',
            'effort' => 'Esfuerzo',
            'quick_win_note' => "Poco esfuerzo,\ngran impacto",
        ],
    ],
];
```

- [ ] **Step 6: The `template` parameter**

Replace `app/Http/Controllers/TeamWhiteboardsController.php` with:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Whiteboards\CreateWhiteboard;
use App\Models\Team;
use App\Models\Workspace;
use App\Support\WhiteboardTemplates\BuiltInTemplates;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class TeamWhiteboardsController extends Controller
{
    public function __construct(private BuiltInTemplates $builtInTemplates) {}

    public function store(Request $request, Workspace $workspace, Team $team, CreateWhiteboard $createWhiteboard): RedirectResponse
    {
        Gate::authorize('createWhiteboard', $team);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'template' => ['sometimes', 'nullable', 'string', Rule::in(BuiltInTemplates::keys())],
        ]);

        $board = $createWhiteboard->handle($team, $request->user(), $validated['title'], [
            'elements' => $this->builtInTemplates->elements($validated['template'] ?? BuiltInTemplates::Blank),
            'files' => [],
        ]);

        return to_route('whiteboards.show', $board);
    }
}
```

The creator's locale is already the request locale (`app/Http/Middleware/SetLocale.php`, `tests/Feature/LocaleTest.php`).

- [ ] **Step 7: Run, gates, commit**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards tests/Feature/TranslationKeysTest.php`
Expected: PASS.

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/phpstan analyse --memory-limit=1G app/Support/WhiteboardTemplates app/Http/Controllers/TeamWhiteboardsController.php
git add app/Support/WhiteboardTemplates resources/whiteboard-templates lang/en/whiteboards.php lang/fr/whiteboards.php lang/de/whiteboards.php lang/es/whiteboards.php app/Http/Controllers/TeamWhiteboardsController.php tests/Feature/Whiteboards/BuiltInWhiteboardTemplatesTest.php
git commit -m "feat(whiteboard): eight built-in templates with translated texts and locked structure"
```

---

### Task 4: Workspace templates

**Files:**
- Create: `database/migrations/2026_10_10_100000_create_whiteboard_templates_table.php`, `app/Models/WhiteboardTemplate.php`, `database/factories/WhiteboardTemplateFactory.php`, `app/Policies/WhiteboardTemplatePolicy.php`
- Create: `app/Actions/Whiteboards/WhiteboardTemplateRules.php`, `PresentWhiteboardPreview.php`, `SaveWhiteboardTemplate.php`
- Create: `app/Http/Controllers/Whiteboards/WhiteboardTemplatesController.php`, `app/Http/Controllers/WorkspaceWhiteboardTemplatesController.php`
- Modify: `app/Models/Workspace.php`, `app/Actions/Whiteboards/WhiteboardGuard.php`, `app/Actions/Whiteboards/PruneWhiteboardFiles.php`, `app/Http/Controllers/TeamWhiteboardsController.php`, `routes/web.php`, `lang/{en,fr,de,es}.json`
- Test: `tests/Feature/Whiteboards/WhiteboardTemplatesTest.php`, `tests/Feature/Whiteboards/PresentWhiteboardPreviewTest.php`; modify `tests/Feature/Whiteboards/PruneWhiteboardsTest.php`

**Interfaces:**
- Consumes: `ReadWhiteboardScene::handle(Whiteboard): Scene`, `CreateWhiteboard::handle(…, array $scene)`, `BuiltInTemplates` (Tasks 2–3); `User::canManage(Workspace)`, `User::belongsToWorkspace(Workspace)`.
- Produces:
  - Table `whiteboard_templates` (`id`, `workspace_id`, `name` 80, `description` 300 null, `scene` json, `preview` json, `created_by_user_id` null, timestamps; unique `(workspace_id, lower(name))`)
  - `WhiteboardTemplate` (`scene: Scene`, `preview: Preview`, `storageDirectory(): string` = `whiteboard-templates/{id}`, const `StorageRoot`), `Workspace::whiteboardTemplates(): HasMany`
  - `WhiteboardGuard::notGuest(WhiteboardMember $member): void` — 403 "Guests cannot do this."
  - `WhiteboardTemplateRules::MaxTemplates = 50`, `ensureRoom(Workspace $locked)`, `ensureNameIsFree(Workspace $locked, string $name, ?WhiteboardTemplate $ignore = null)`
  - `PresentWhiteboardPreview::handle(array $elements): Preview`, const `MaxShapes = 300`
  - `SaveWhiteboardTemplate::handle(Whiteboard $board, User $user, string $name, ?string $description): WhiteboardTemplate`
  - Routes: `POST whiteboards/{board}/template` → `whiteboards.template.store` (201 `{id, name}`); `PATCH|DELETE w/{workspace}/whiteboard-templates/{whiteboardTemplate}` → `workspaces.whiteboardTemplates.update|destroy` (redirect back)
  - `POST teams/{team}/whiteboards` accepts `workspace_template_id` (uuid, nullable), exclusive with `template`.

Decisions: the template keeps its own copy of each image under `whiteboard-templates/{templateId}/{fileId}` and lists them in `scene.files`, so a board file is "used" only by the board's own elements and the prune simply removes template folders without a template. Authors, votes and private flags are not part of a scene (`ReadWhiteboardScene` returns element data only). The policy is found by Laravel's naming convention (no `Gate::policy` call). The guest check lives in the controller because guests have no user. The team routes already require `auth`, `verified` and `can:view,workspace`, which is what keeps guests away from listing and using templates.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Whiteboards/WhiteboardTemplatesTest.php`:

```php
<?php

use App\Actions\Whiteboards\WhiteboardTemplateRules;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;
use App\Models\WhiteboardTemplate;
use App\Models\Workspace;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake();
});

/**
 * A board with a locked frame, a sticky note with its text, a deleted box
 * and one image, written by the facilitator.
 *
 * @return array{0: Whiteboard, 1: User, 2: WhiteboardFile}
 */
function boardWorthSaving(): array
{
    $board = Whiteboard::factory()->create(['seq' => 5]);
    [$user, $member] = whiteboardFacilitator($board);
    $file = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id, 'mime_type' => 'image/png', 'size' => 11]);
    Storage::put($file->path, 'image bytes');

    $elements = [
        sceneElement(['id' => 'zone', 'type' => 'frame', 'name' => 'Zone', 'locked' => true, 'index' => 'a3', 'width' => 400, 'height' => 300]),
        sceneElement(['id' => 'note', 'index' => 'a1', 'frameId' => 'zone', 'backgroundColor' => '#fff3bf', 'customData' => ['skrum' => ['kind' => 'sticky']], 'boundElements' => [['id' => 'words', 'type' => 'text']]]),
        sceneElement(['id' => 'words', 'type' => 'text', 'text' => 'Ship it', 'originalText' => 'Ship it', 'containerId' => 'note', 'index' => 'a2']),
        sceneElement(['id' => 'photo', 'type' => 'image', 'fileId' => $file->file_id, 'status' => 'saved', 'scale' => [1, 1], 'index' => 'a4']),
        sceneElement(['id' => 'erased', 'index' => 'a5', 'isDeleted' => true]),
    ];

    foreach ($elements as $position => $element) {
        WhiteboardElement::factory()->create([
            'whiteboard_id' => $board->id,
            'element_id' => $element['id'],
            'type' => $element['type'],
            'data' => $element,
            'author_member_id' => $member->id,
            'is_sticky' => isset($element['customData']),
            'is_deleted' => $element['isDeleted'],
            'seq' => $position + 1,
        ]);
    }

    return [$board, $user, $file];
}

function saveTemplate(mixed $test, Whiteboard $board, array $body = ['name' => 'Kick-off']): mixed
{
    return $test->postJson(route('whiteboards.template.store', $board), $body);
}

it('saves the live scene of a board, with its images, as a workspace template', function () {
    [$board, $user, $file] = boardWorthSaving();

    saveTemplate($this->actingAs($user), $board, ['name' => 'Kick-off', 'description' => 'How we start a project'])
        ->assertCreated()
        ->assertJsonPath('name', 'Kick-off');

    $template = WhiteboardTemplate::query()->sole();
    $copy = "whiteboard-templates/{$template->id}/{$file->file_id}";

    expect($template->workspace_id)->toBe($board->team->workspace_id)
        ->and($template->description)->toBe('How we start a project')
        ->and($template->created_by_user_id)->toBe($user->id)
        ->and(array_column($template->scene['elements'], 'id'))->toBe(['note', 'words', 'zone', 'photo'])
        ->and($template->scene['elements'][1]['text'])->toBe('Ship it')
        ->and($template->scene['files'])->toBe([['fileId' => $file->file_id, 'path' => $copy, 'mimeType' => 'image/png', 'size' => 11]])
        ->and(Storage::get($copy))->toBe('image bytes')
        ->and(array_column($template->preview['shapes'], 'kind'))->toBe(['rect', 'rect', 'rect'])
        ->and(json_encode($template->scene))->not->toContain($board->facilitator_member_id)
        ->and(json_encode($template->scene))->not->toContain($user->id);
});

it('refuses guests, outsiders and logged-out visitors', function () {
    [$board] = boardWorthSaving();
    $board->update(['guest_access_enabled' => true]);
    $guest = whiteboardGuest($board);

    saveTemplate($this->withCookies(whiteboardGuestCookie($guest))->withCredentials(), $board)
        ->assertForbidden()
        ->assertJsonPath('message', 'Guests cannot do this.');

    $outsider = User::factory()->create();
    $board->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    saveTemplate($this->actingAs($outsider), $board)->assertForbidden();

    expect(WhiteboardTemplate::query()->count())->toBe(0);
});

it('answers a logged-out save with 401', function () {
    saveTemplate($this, Whiteboard::factory()->create())->assertUnauthorized();
});

it('validates the name and the description', function (array $body, string $field) {
    [$board, $user] = boardWorthSaving();

    saveTemplate($this->actingAs($user), $board, $body)->assertJsonValidationErrors($field);

    expect(WhiteboardTemplate::query()->count())->toBe(0);
})->with([
    'no name' => [['name' => ''], 'name'],
    'long name' => [['name' => str_repeat('a', 81)], 'name'],
    'long description' => [['name' => 'Fine', 'description' => str_repeat('a', 301)], 'description'],
]);

it('refuses a name already used in the workspace, whatever its case', function () {
    [$board, $user] = boardWorthSaving();
    WhiteboardTemplate::factory()->create(['workspace_id' => $board->team->workspace_id, 'name' => 'Sprint Map']);
    WhiteboardTemplate::factory()->create(['name' => 'Elsewhere']);

    saveTemplate($this->actingAs($user), $board, ['name' => '  sprint MAP '])
        ->assertUnprocessable()
        ->assertJsonPath('errors.name.0', 'A template with this name already exists.');

    saveTemplate($this->actingAs($user), $board, ['name' => 'Elsewhere'])->assertCreated();
});

it('keeps the name unique in the database too', function () {
    $workspace = Workspace::factory()->create();
    WhiteboardTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Sprint Map']);

    expect(fn () => WhiteboardTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'sprint map']))
        ->toThrow(QueryException::class);
});

it('stops at fifty templates per workspace', function () {
    [$board, $user] = boardWorthSaving();
    WhiteboardTemplate::factory()->count(WhiteboardTemplateRules::MaxTemplates)->create(['workspace_id' => $board->team->workspace_id]);

    saveTemplate($this->actingAs($user), $board)
        ->assertUnprocessable()
        ->assertJsonPath('errors.name.0', 'This workspace already has 50 whiteboard templates.');

    expect(WhiteboardTemplate::query()->count())->toBe(50);
});

it('lets another member create a board from the template, on its own from then on', function () {
    [$source, $user, $file] = boardWorthSaving();
    saveTemplate($this->actingAs($user), $source)->assertCreated();
    $template = WhiteboardTemplate::query()->sole();

    $team = Team::factory()->create(['workspace_id' => $source->team->workspace_id]);
    $other = teamMember($team);

    $this->actingAs($other)
        ->post(route('teams.whiteboards.store', [$team->workspace, $team]), ['title' => 'From template', 'workspace_template_id' => $template->id])
        ->assertRedirect();

    $board = Whiteboard::query()->whereKeyNot($source->id)->sole();
    $elements = $board->elements()->orderBy('seq')->get();
    [$note, $words, $zone, $photo] = $elements->map(fn (WhiteboardElement $element) => $element->data)->all();

    expect($board->team_id)->toBe($team->id)
        ->and($board->facilitator->user_id)->toBe($other->id)
        ->and($elements)->toHaveCount(4)
        ->and($elements->pluck('author_member_id')->unique()->all())->toBe([$board->facilitator_member_id])
        ->and($elements->pluck('element_id')->intersect(['note', 'words', 'zone', 'photo'])->all())->toBe([])
        ->and($note['customData'])->toBe(['skrum' => ['kind' => 'sticky']])
        ->and($note['frameId'])->toBe($zone['id'])
        ->and($words['containerId'])->toBe($note['id'])
        ->and($words['text'])->toBe('Ship it')
        ->and($zone['locked'])->toBeTrue()
        ->and($photo['fileId'])->toBe($file->file_id)
        ->and($board->files()->sole()->path)->toBe("whiteboards/{$board->id}/{$file->file_id}");

    $this->actingAs($other)->get(route('whiteboards.files.show', [$board, $file->file_id]))->assertOk();

    $this->actingAs($other)
        ->putJson(route('whiteboards.elements.update', $board), ['elements' => [[...$words, 'version' => 2, 'text' => 'Changed', 'originalText' => 'Changed']]])
        ->assertOk()
        ->assertJsonPath('rejected', []);

    $template->delete();
    $source->delete();

    expect($template->scene['elements'][1]['text'])->toBe('Ship it');
    Storage::assertExists("whiteboards/{$board->id}/{$file->file_id}");
    Storage::assertMissing("whiteboard-templates/{$template->id}/{$file->file_id}");
});

it('refuses a template of another workspace, an unknown one, and two templates at once', function (string $case) {
    $team = Team::factory()->create();
    $own = WhiteboardTemplate::factory()->create(['workspace_id' => $team->workspace_id]);
    $foreign = WhiteboardTemplate::factory()->create();

    $body = match ($case) {
        'another workspace' => ['workspace_template_id' => $foreign->id],
        'unknown' => ['workspace_template_id' => '00000000-0000-0000-0000-000000000000'],
        'not a uuid' => ['workspace_template_id' => 'swot'],
        'both' => ['workspace_template_id' => $own->id, 'template' => 'swot'],
    };

    $this->actingAs(teamMember($team))
        ->post(route('teams.whiteboards.store', [$team->workspace, $team]), ['title' => 'Nope', ...$body])
        ->assertSessionHasErrors('workspace_template_id');

    expect(Whiteboard::query()->count())->toBe(0);
})->with(['another workspace', 'unknown', 'not a uuid', 'both']);

it('never lets a guest create a board from a template', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    $guest = whiteboardGuest($board);
    $template = WhiteboardTemplate::factory()->create(['workspace_id' => $board->team->workspace_id]);

    $this->withCookies(whiteboardGuestCookie($guest))->withCredentials()
        ->post(route('teams.whiteboards.store', [$board->team->workspace, $board->team]), ['title' => 'Guest', 'workspace_template_id' => $template->id])
        ->assertRedirect(route('login'));

    expect(Whiteboard::query()->count())->toBe(1);
});

it('lets the creator and a workspace admin rename and describe a template', function () {
    $workspace = Workspace::factory()->create();
    $creator = workspaceManager($workspace, WorkspaceRole::Member);
    $template = WhiteboardTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Draft', 'created_by_user_id' => $creator->id]);

    $this->actingAs($creator)
        ->patch(route('workspaces.whiteboardTemplates.update', [$workspace, $template]), ['name' => 'Final', 'description' => 'Ready'])
        ->assertRedirect();

    expect($template->fresh()->name)->toBe('Final')
        ->and($template->fresh()->description)->toBe('Ready');

    $this->actingAs(workspaceManager($workspace))
        ->patch(route('workspaces.whiteboardTemplates.update', [$workspace, $template]), ['description' => ''])
        ->assertRedirect();

    expect($template->fresh()->name)->toBe('Final')
        ->and($template->fresh()->description)->toBeNull();
});

it('keeps names unique when renaming, but lets a template keep its own', function () {
    $workspace = Workspace::factory()->create();
    $admin = workspaceManager($workspace);
    WhiteboardTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Taken']);
    $template = WhiteboardTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Mine']);

    $this->actingAs($admin)
        ->patch(route('workspaces.whiteboardTemplates.update', [$workspace, $template]), ['name' => 'TAKEN'])
        ->assertSessionHasErrors(['name' => 'A template with this name already exists.']);

    $this->actingAs($admin)
        ->patch(route('workspaces.whiteboardTemplates.update', [$workspace, $template]), ['name' => 'MINE'])
        ->assertSessionHasNoErrors();

    expect($template->fresh()->name)->toBe('MINE');
});

it('refuses other members and other workspaces', function () {
    $workspace = Workspace::factory()->create();
    $template = WhiteboardTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Kept']);
    $member = workspaceManager($workspace, WorkspaceRole::Member);
    $formerCreator = $template->created_by_user_id;

    $this->actingAs($member)
        ->patch(route('workspaces.whiteboardTemplates.update', [$workspace, $template]), ['name' => 'Stolen'])
        ->assertForbidden();
    $this->actingAs($member)
        ->delete(route('workspaces.whiteboardTemplates.destroy', [$workspace, $template]))
        ->assertForbidden();
    $this->actingAs(User::query()->findOrFail($formerCreator))
        ->delete(route('workspaces.whiteboardTemplates.destroy', [$workspace, $template]))
        ->assertForbidden();

    $elsewhere = Workspace::factory()->create();

    $this->actingAs(workspaceManager($elsewhere))
        ->delete(route('workspaces.whiteboardTemplates.destroy', [$elsewhere, $template]))
        ->assertNotFound();

    expect($template->fresh()->name)->toBe('Kept');
});

it('deletes a template with its images', function () {
    $workspace = Workspace::factory()->create();
    $template = WhiteboardTemplate::factory()->create(['workspace_id' => $workspace->id]);
    Storage::put("whiteboard-templates/{$template->id}/abc", 'bytes');

    $this->actingAs(workspaceManager($workspace))
        ->delete(route('workspaces.whiteboardTemplates.destroy', [$workspace, $template]))
        ->assertRedirect();

    expect(WhiteboardTemplate::query()->count())->toBe(0);
    Storage::assertMissing("whiteboard-templates/{$template->id}/abc");
});

it('prunes the folder of a template that is gone, once its files are a day old', function () {
    $template = WhiteboardTemplate::factory()->create();
    $kept = "whiteboard-templates/{$template->id}/abc";
    $old = 'whiteboard-templates/00000000-0000-0000-0000-000000000001/abc';
    $recent = 'whiteboard-templates/00000000-0000-0000-0000-000000000002/abc';

    foreach ([$kept, $old, $recent] as $path) {
        Storage::put($path, 'bytes');
    }

    touch(Storage::path($kept), now()->subDays(2)->getTimestamp());
    touch(Storage::path($old), now()->subDays(2)->getTimestamp());

    $this->artisan('skrum:prune-whiteboards')->assertSuccessful();

    Storage::assertExists($kept);
    Storage::assertMissing($old);
    Storage::assertExists($recent);
});
```

`tests/Feature/Whiteboards/PresentWhiteboardPreviewTest.php`:

```php
<?php

use App\Actions\Whiteboards\PresentWhiteboardPreview;

it('outlines a scene from its top-left corner, without any text', function () {
    $preview = app(PresentWhiteboardPreview::class)->handle([
        sceneElement(['id' => 'zone', 'type' => 'frame', 'x' => -100, 'y' => 50, 'width' => 400, 'height' => 300, 'name' => 'Secret zone']),
        sceneElement(['id' => 'note', 'x' => -60.4, 'y' => 90.6, 'width' => 200, 'height' => 200, 'backgroundColor' => '#fff3bf', 'strokeColor' => 'transparent']),
        sceneElement(['id' => 'words', 'type' => 'text', 'text' => 'Secret words', 'containerId' => 'note']),
        sceneElement(['id' => 'title', 'type' => 'text', 'text' => 'Secret title', 'x' => 0, 'y' => 0, 'width' => 120, 'height' => 25]),
        sceneElement(['id' => 'round', 'type' => 'ellipse', 'x' => 400, 'y' => 400, 'width' => 80, 'height' => 40]),
        sceneElement(['id' => 'choice', 'type' => 'diamond', 'x' => 0, 'y' => 500, 'width' => 80, 'height' => 40]),
        sceneElement(['id' => 'link', 'type' => 'arrow', 'x' => 100, 'y' => 100, 'points' => [[0, 0], [50, -20]]]),
        sceneElement(['id' => 'erased', 'x' => -5000, 'isDeleted' => true]),
    ]);

    expect($preview['width'])->toBe(580)
        ->and($preview['height'])->toBe(540)
        ->and(array_column($preview['shapes'], 'kind'))->toBe(['rect', 'rect', 'text', 'ellipse', 'diamond', 'path'])
        ->and($preview['shapes'][0])->toBe(['kind' => 'rect', 'x' => 0, 'y' => 50, 'width' => 400, 'height' => 300, 'fill' => null, 'stroke' => '#1e1e1e', 'points' => []])
        ->and($preview['shapes'][1])->toBe(['kind' => 'rect', 'x' => 40, 'y' => 91, 'width' => 200, 'height' => 200, 'fill' => '#fff3bf', 'stroke' => null, 'points' => []])
        ->and($preview['shapes'][5]['points'])->toBe([[200, 100], [250, 80]])
        ->and($preview['shapes'][5]['y'])->toBe(80)
        ->and(json_encode($preview))->not->toContain('Secret');
});

it('gives an empty scene an empty preview', function () {
    expect(app(PresentWhiteboardPreview::class)->handle([]))->toBe(['width' => 0, 'height' => 0, 'shapes' => []]);
});

it('stops at three hundred shapes and two dozen points a line', function () {
    $elements = array_map(fn (int $position) => sceneElement(['x' => $position]), range(1, 320));
    $stroke = sceneElement(['type' => 'freedraw', 'x' => 0, 'y' => 0, 'points' => array_map(fn (int $x) => [$x, 0], range(0, 999))]);

    $preview = app(PresentWhiteboardPreview::class);

    expect($preview->handle($elements)['shapes'])->toHaveCount(PresentWhiteboardPreview::MaxShapes)
        ->and(count($preview->handle([$stroke])['shapes'][0]['points']))->toBeLessThanOrEqual(25)
        ->and($preview->handle([$stroke])['shapes'][0]['width'])->toBe(999);
});

it('ignores a colour that is not a plain hex value', function () {
    $preview = app(PresentWhiteboardPreview::class)->handle([
        sceneElement(['backgroundColor' => 'url(#x)', 'strokeColor' => 'red;']),
    ]);

    expect($preview['shapes'][0]['fill'])->toBeNull()
        ->and($preview['shapes'][0]['stroke'])->toBeNull();
});
```

In `tests/Feature/Whiteboards/PruneWhiteboardsTest.php`, test "deletes day-old images no live element uses and the folders of gone boards": after the line that stores `whiteboards/00000000-0000-0000-0000-000000000000/orphan` add

```php
    touch(Storage::path('whiteboards/00000000-0000-0000-0000-000000000000/orphan'), now()->subDays(2)->getTimestamp());
    Storage::put('whiteboards/00000000-0000-0000-0000-000000000009/being-copied', 'bytes');
```

and after its last `Storage::assertMissing(...)` add

```php
    Storage::assertExists('whiteboards/00000000-0000-0000-0000-000000000009/being-copied');
```

- [ ] **Step 2: Run them to see them fail**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards/WhiteboardTemplatesTest.php tests/Feature/Whiteboards/PresentWhiteboardPreviewTest.php tests/Feature/Whiteboards/PruneWhiteboardsTest.php`
Expected: FAIL — `Class "App\Models\WhiteboardTemplate" not found`, `PresentWhiteboardPreview` not found, and the prune test on `being-copied`.

- [ ] **Step 3: Table, model, factory, relation**

Run `php artisan make:migration create_whiteboard_templates_table --no-interaction`, rename to `2026_10_10_100000_create_whiteboard_templates_table.php`, body:

`database/migrations/2026_10_10_100000_create_whiteboard_templates_table.php`:

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
        Schema::create('whiteboard_templates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->string('description', 300)->nullable();
            $table->json('scene');
            $table->json('preview');
            $table->foreignUuid('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('workspace_id');
        });

        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('create unique index whiteboard_templates_workspace_name_unique on whiteboard_templates (workspace_id, lower(name))');
    }
};
```

`app/Models/WhiteboardTemplate.php`:

```php
<?php

namespace App\Models;

use App\Actions\Whiteboards\CopyWhiteboardScene;
use App\Actions\Whiteboards\PresentWhiteboardPreview;
use Database\Factories\WhiteboardTemplateFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * A scene saved from a board for the whole workspace. Boards copy it, images
 * included, so changing or deleting it never changes a board.
 *
 * @phpstan-import-type Scene from CopyWhiteboardScene
 * @phpstan-import-type Preview from PresentWhiteboardPreview
 *
 * @property string $id
 * @property string $workspace_id
 * @property string $name
 * @property string|null $description
 * @property Scene $scene
 * @property Preview $preview
 * @property string|null $created_by_user_id
 * @property-read Workspace $workspace
 */
#[Fillable(['name', 'description', 'scene', 'preview', 'created_by_user_id'])]
class WhiteboardTemplate extends Model
{
    /** @use HasFactory<WhiteboardTemplateFactory> */
    use HasFactory;

    use HasUuids;

    public const StorageRoot = 'whiteboard-templates';

    protected static function booted(): void
    {
        static::deleted(function (WhiteboardTemplate $template): void {
            Storage::deleteDirectory($template->storageDirectory());
        });
    }

    /** @return BelongsTo<Workspace, $this> */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function storageDirectory(): string
    {
        return self::StorageRoot."/{$this->id}";
    }

    protected function casts(): array
    {
        return [
            'scene' => 'array',
            'preview' => 'array',
        ];
    }
}
```

`database/factories/WhiteboardTemplateFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\WhiteboardTemplate;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WhiteboardTemplate>
 */
class WhiteboardTemplateFactory extends Factory
{
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'name' => fake()->unique()->words(3, true),
            'description' => null,
            'scene' => ['elements' => [], 'files' => []],
            'preview' => ['width' => 0, 'height' => 0, 'shapes' => []],
            'created_by_user_id' => User::factory(),
        ];
    }
}
```

In `app/Models/Workspace.php`, before `teams()`:

```php
    /** @return HasMany<WhiteboardTemplate, $this> */
    public function whiteboardTemplates(): HasMany
    {
        return $this->hasMany(WhiteboardTemplate::class);
    }
```

Then `vendor/bin/sail artisan migrate --no-interaction`.

- [ ] **Step 4: Policy, guard, rules**

`app/Policies/WhiteboardTemplatePolicy.php`:

```php
<?php

namespace App\Policies;

use App\Models\User;
use App\Models\WhiteboardTemplate;
use Illuminate\Auth\Access\Response;

class WhiteboardTemplatePolicy
{
    public function update(User $user, WhiteboardTemplate $template): Response
    {
        return $this->manage($user, $template);
    }

    public function delete(User $user, WhiteboardTemplate $template): Response
    {
        return $this->manage($user, $template);
    }

    private function manage(User $user, WhiteboardTemplate $template): Response
    {
        if ($user->canManage($template->workspace)) {
            return Response::allow();
        }

        if ($template->created_by_user_id === $user->id && $user->belongsToWorkspace($template->workspace)) {
            return Response::allow();
        }

        return Response::deny(__('Only the creator of this template or a workspace admin can change it.'));
    }
}
```

In `app/Actions/Whiteboards/WhiteboardGuard.php`, before `canDelete`:

```php
    public static function notGuest(WhiteboardMember $member): void
    {
        if (! $member->isGuest()) {
            return;
        }

        throw new AuthorizationException(__('Guests cannot do this.'));
    }
```

`app/Actions/Whiteboards/WhiteboardTemplateRules.php`:

```php
<?php

namespace App\Actions\Whiteboards;

use App\Models\WhiteboardTemplate;
use App\Models\Workspace;
use Illuminate\Validation\ValidationException;

/**
 * Both checks are made with the workspace row locked, inside the transaction
 * that writes the template, so two requests cannot pass them together.
 */
class WhiteboardTemplateRules
{
    public const MaxTemplates = 50;

    public static function ensureRoom(Workspace $lockedWorkspace): void
    {
        if ($lockedWorkspace->whiteboardTemplates()->count() < self::MaxTemplates) {
            return;
        }

        throw ValidationException::withMessages(['name' => __('This workspace already has 50 whiteboard templates.')]);
    }

    public static function ensureNameIsFree(Workspace $lockedWorkspace, string $name, ?WhiteboardTemplate $ignore = null): void
    {
        $isTaken = $lockedWorkspace->whiteboardTemplates()
            ->whereRaw('lower(name) = ?', [mb_strtolower(trim($name))])
            ->when($ignore !== null, fn ($query) => $query->whereKeyNot($ignore?->id))
            ->exists();

        if (! $isTaken) {
            return;
        }

        throw ValidationException::withMessages(['name' => __('A template with this name already exists.')]);
    }
}
```

- [ ] **Step 5: Preview and save**

`app/Actions/Whiteboards/PresentWhiteboardPreview.php`:

```php
<?php

namespace App\Actions\Whiteboards;

/**
 * What the template gallery draws: the outline of each element, without any
 * text, moved so that the scene starts at 0,0.
 *
 * @phpstan-type Shape array{
 *     kind: string,
 *     x: int,
 *     y: int,
 *     width: int,
 *     height: int,
 *     fill: ?string,
 *     stroke: ?string,
 *     points: list<array{0: int, 1: int}>
 * }
 * @phpstan-type Preview array{width: int, height: int, shapes: list<Shape>}
 */
class PresentWhiteboardPreview
{
    public const MaxShapes = 300;

    private const MaxPoints = 24;

    private const Kinds = [
        'rectangle' => 'rect',
        'image' => 'rect',
        'frame' => 'rect',
        'ellipse' => 'ellipse',
        'diamond' => 'diamond',
        'line' => 'path',
        'arrow' => 'path',
        'freedraw' => 'path',
        'text' => 'text',
    ];

    private const ColorPattern = '/^#[0-9a-fA-F]{3,8}$/';

    /**
     * @param  array<int, array<string, mixed>>  $elements  in canvas order
     * @return Preview
     */
    public function handle(array $elements): array
    {
        $shapes = [];

        foreach ($elements as $element) {
            if (count($shapes) === self::MaxShapes) {
                break;
            }

            $shape = $this->shape($element);

            if ($shape !== null) {
                $shapes[] = $shape;
            }
        }

        if ($shapes === []) {
            return ['width' => 0, 'height' => 0, 'shapes' => []];
        }

        $left = min(array_column($shapes, 'x'));
        $top = min(array_column($shapes, 'y'));

        $shapes = array_map(fn (array $shape): array => [
            ...$shape,
            'x' => $shape['x'] - $left,
            'y' => $shape['y'] - $top,
            'points' => array_map(fn (array $point): array => [$point[0] - $left, $point[1] - $top], $shape['points']),
        ], $shapes);

        return [
            'width' => max(1, max(array_map(fn (array $shape): int => $shape['x'] + $shape['width'], $shapes))),
            'height' => max(1, max(array_map(fn (array $shape): int => $shape['y'] + $shape['height'], $shapes))),
            'shapes' => $shapes,
        ];
    }

    /**
     * @param  array<string, mixed>  $element
     * @return Shape|null
     */
    private function shape(array $element): ?array
    {
        $kind = self::Kinds[$element['type'] ?? ''] ?? null;

        if ($kind === null || ($element['isDeleted'] ?? false) || ($element['containerId'] ?? null) !== null) {
            return null;
        }

        $points = $kind === 'path' ? $this->points($element) : [];
        $xs = $points === [] ? [(int) round($element['x']), (int) round($element['x'] + $element['width'])] : array_column($points, 0);
        $ys = $points === [] ? [(int) round($element['y']), (int) round($element['y'] + $element['height'])] : array_column($points, 1);

        return [
            'kind' => $kind,
            'x' => min($xs),
            'y' => min($ys),
            'width' => max($xs) - min($xs),
            'height' => max($ys) - min($ys),
            'fill' => $this->color($element['backgroundColor'] ?? null),
            'stroke' => $this->color($element['strokeColor'] ?? null),
            'points' => $points,
        ];
    }

    /**
     * @param  array<string, mixed>  $element
     * @return list<array{0: int, 1: int}>
     */
    private function points(array $element): array
    {
        $points = $element['points'] ?? [];
        $step = max(1, (int) ceil(count($points) / self::MaxPoints));
        $kept = [];

        foreach ($points as $position => $point) {
            if ($position % $step === 0 || $position === count($points) - 1) {
                $kept[] = [(int) round($element['x'] + $point[0]), (int) round($element['y'] + $point[1])];
            }
        }

        return $kept;
    }

    private function color(mixed $color): ?string
    {
        if (! is_string($color) || preg_match(self::ColorPattern, $color) !== 1) {
            return null;
        }

        return $color;
    }
}
```

`app/Actions/Whiteboards/SaveWhiteboardTemplate.php`:

```php
<?php

namespace App\Actions\Whiteboards;

use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardTemplate;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * @phpstan-import-type SceneFile from CopyWhiteboardScene
 */
class SaveWhiteboardTemplate
{
    public function __construct(
        private ReadWhiteboardScene $readWhiteboardScene,
        private PresentWhiteboardPreview $presentWhiteboardPreview,
    ) {}

    public function handle(Whiteboard $board, User $user, string $name, ?string $description): WhiteboardTemplate
    {
        return DB::transaction(function () use ($board, $user, $name, $description): WhiteboardTemplate {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();
            $workspace = Workspace::query()->whereKey($locked->team->workspace_id)->lockForUpdate()->firstOrFail();

            WhiteboardTemplateRules::ensureRoom($workspace);
            WhiteboardTemplateRules::ensureNameIsFree($workspace, $name);

            $scene = $this->readWhiteboardScene->handle($locked);

            $template = $workspace->whiteboardTemplates()->make([
                'name' => $name,
                'description' => $description,
                'preview' => $this->presentWhiteboardPreview->handle($scene['elements']),
                'created_by_user_id' => $user->id,
            ]);

            $template->id = $template->newUniqueId();
            $template->scene = ['elements' => $scene['elements'], 'files' => $this->copyFiles($template, $scene['files'])];
            $template->save();

            return $template;
        });
    }

    /**
     * The template owns its images: the board may be changed or deleted.
     *
     * @param  list<SceneFile>  $files
     * @return list<SceneFile>
     */
    private function copyFiles(WhiteboardTemplate $template, array $files): array
    {
        $copies = [];

        foreach ($files as $file) {
            if (! Storage::exists($file['path'])) {
                continue;
            }

            $path = "{$template->storageDirectory()}/{$file['fileId']}";

            Storage::copy($file['path'], $path);

            $copies[] = [...$file, 'path' => $path];
        }

        return $copies;
    }
}
```

Lock order is always board, then workspace.

- [ ] **Step 6: Controllers and routes**

`app/Http/Controllers/Whiteboards/WhiteboardTemplatesController.php`:

```php
<?php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\SaveWhiteboardTemplate;
use App\Actions\Whiteboards\WhiteboardGuard;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WhiteboardTemplatesController extends Controller
{
    public function store(Request $request, Whiteboard $board, SaveWhiteboardTemplate $saveWhiteboardTemplate): JsonResponse
    {
        WhiteboardGuard::notGuest(WhiteboardMember::current($request));

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:300'],
        ]);

        $template = $saveWhiteboardTemplate->handle($board, $request->user(), $validated['name'], $validated['description'] ?? null);

        return response()->json(['id' => $template->id, 'name' => $template->name], 201);
    }
}
```

`app/Http/Controllers/WorkspaceWhiteboardTemplatesController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Whiteboards\WhiteboardTemplateRules;
use App\Models\WhiteboardTemplate;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class WorkspaceWhiteboardTemplatesController extends Controller
{
    public function update(Request $request, Workspace $workspace, WhiteboardTemplate $whiteboardTemplate): RedirectResponse
    {
        Gate::authorize('update', $whiteboardTemplate);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:80'],
            'description' => ['sometimes', 'nullable', 'string', 'max:300'],
        ]);

        DB::transaction(function () use ($workspace, $whiteboardTemplate, $validated): void {
            $locked = Workspace::query()->whereKey($workspace->id)->lockForUpdate()->firstOrFail();

            if (array_key_exists('name', $validated)) {
                WhiteboardTemplateRules::ensureNameIsFree($locked, $validated['name'], $whiteboardTemplate);
            }

            $whiteboardTemplate->update($validated);
        });

        return back();
    }

    public function destroy(Workspace $workspace, WhiteboardTemplate $whiteboardTemplate): RedirectResponse
    {
        Gate::authorize('delete', $whiteboardTemplate);

        $whiteboardTemplate->delete();

        return back();
    }
}
```

`ConvertEmptyStringsToNull` turns `description: ''` into null, which clears it (tested).

`app/Http/Controllers/TeamWhiteboardsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Whiteboards\CopyWhiteboardScene;
use App\Actions\Whiteboards\CreateWhiteboard;
use App\Models\Team;
use App\Models\Workspace;
use App\Support\WhiteboardTemplates\BuiltInTemplates;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * @phpstan-import-type Scene from CopyWhiteboardScene
 */
class TeamWhiteboardsController extends Controller
{
    public function __construct(private BuiltInTemplates $builtInTemplates) {}

    public function store(Request $request, Workspace $workspace, Team $team, CreateWhiteboard $createWhiteboard): RedirectResponse
    {
        Gate::authorize('createWhiteboard', $team);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'template' => ['sometimes', 'nullable', 'string', Rule::in(BuiltInTemplates::keys())],
            'workspace_template_id' => ['sometimes', 'nullable', 'uuid'],
        ]);

        $board = $createWhiteboard->handle(
            $team,
            $request->user(),
            $validated['title'],
            $this->scene($workspace, $validated['template'] ?? null, $validated['workspace_template_id'] ?? null),
        );

        return to_route('whiteboards.show', $board);
    }

    /**
     * @return Scene
     */
    private function scene(Workspace $workspace, ?string $builtInKey, ?string $workspaceTemplateId): array
    {
        if ($workspaceTemplateId === null) {
            return ['elements' => $this->builtInTemplates->elements($builtInKey ?? BuiltInTemplates::Blank), 'files' => []];
        }

        if ($builtInKey !== null) {
            throw ValidationException::withMessages(['workspace_template_id' => __('Choose either a built-in template or a workspace template.')]);
        }

        $template = $workspace->whiteboardTemplates()->whereKey($workspaceTemplateId)->first();

        if ($template === null) {
            throw ValidationException::withMessages(['workspace_template_id' => __('Choose a template of this workspace.')]);
        }

        return $template->scene;
    }
}
```

In `routes/web.php`: import `App\Http\Controllers\Whiteboards\WhiteboardTemplatesController` and `App\Http\Controllers\WorkspaceWhiteboardTemplatesController`; inside the `w/{workspace}` group, after the `templates` routes:

```php
            Route::patch('whiteboard-templates/{whiteboardTemplate}', [WorkspaceWhiteboardTemplatesController::class, 'update'])->name('workspaces.whiteboardTemplates.update')->whereUuid('whiteboardTemplate');
            Route::delete('whiteboard-templates/{whiteboardTemplate}', [WorkspaceWhiteboardTemplatesController::class, 'destroy'])->name('workspaces.whiteboardTemplates.destroy')->whereUuid('whiteboardTemplate');
```

and inside the `whiteboards/{board}` group, after `files/{fileId}`:

```php
        Route::post('template', [WhiteboardTemplatesController::class, 'store'])->name('whiteboards.template.store');
```

The parameter is `whiteboardTemplate` (not `template`) because `{template}` in that group is already the retro `WorkspaceTemplate`; `scopeBindings` resolves it through `Workspace::whiteboardTemplates()`, which is why another workspace's template answers 404.

- [ ] **Step 7: Prune**

`app/Actions/Whiteboards/PruneWhiteboardFiles.php`:

```php
<?php

namespace App\Actions\Whiteboards;

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;
use App\Models\WhiteboardTemplate;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

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

        $this->deleteFoldersWithoutOwner(self::Root, Whiteboard::class);
        $this->deleteFoldersWithoutOwner(WhiteboardTemplate::StorageRoot, WhiteboardTemplate::class);

        return $pruned;
    }

    /**
     * A template keeps its own copy of every image (spec §10), so only the
     * board's elements use a board's file. Plan 17d adds versions.
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
     * events, so the folder of a board or template outlives it. A folder
     * with a recent file is left alone: a copy writes its files before the
     * transaction that creates their owner commits.
     *
     * @param  class-string<Model>  $owner
     */
    private function deleteFoldersWithoutOwner(string $root, string $owner): void
    {
        $recent = now()->subHours(self::KeepHours)->getTimestamp();

        foreach (Storage::directories($root) as $directory) {
            $ownerId = basename($directory);

            if (! Str::isUuid($ownerId)) {
                continue;
            }

            if ($owner::query()->whereKey($ownerId)->exists()) {
                continue;
            }

            if (collect(Storage::allFiles($directory))->contains(fn (string $path): bool => Storage::lastModified($path) >= $recent)) {
                continue;
            }

            Storage::deleteDirectory($directory);
        }
    }
}
```

- [ ] **Step 8: Translation keys** — add the Task 4 rows of Appendix A to the four JSON files.

- [ ] **Step 9: Run, gates, commit**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards tests/Feature/UuidPrimaryKeysTest.php tests/Feature/TranslationKeysTest.php tests/Feature/Workspaces`
Expected: PASS.

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/phpstan analyse --memory-limit=1G app/Actions/Whiteboards app/Models/WhiteboardTemplate.php app/Models/Workspace.php app/Policies/WhiteboardTemplatePolicy.php app/Http/Controllers/Whiteboards app/Http/Controllers/WorkspaceWhiteboardTemplatesController.php app/Http/Controllers/TeamWhiteboardsController.php database/factories/WhiteboardTemplateFactory.php
git add database/migrations/2026_10_10_100000_create_whiteboard_templates_table.php app/Models/WhiteboardTemplate.php app/Models/Workspace.php database/factories/WhiteboardTemplateFactory.php app/Policies/WhiteboardTemplatePolicy.php app/Actions/Whiteboards/WhiteboardTemplateRules.php app/Actions/Whiteboards/PresentWhiteboardPreview.php app/Actions/Whiteboards/SaveWhiteboardTemplate.php app/Actions/Whiteboards/WhiteboardGuard.php app/Actions/Whiteboards/PruneWhiteboardFiles.php app/Http/Controllers/Whiteboards/WhiteboardTemplatesController.php app/Http/Controllers/WorkspaceWhiteboardTemplatesController.php app/Http/Controllers/TeamWhiteboardsController.php routes/web.php lang/en.json lang/fr.json lang/de.json lang/es.json tests/Feature/Whiteboards/WhiteboardTemplatesTest.php tests/Feature/Whiteboards/PresentWhiteboardPreviewTest.php tests/Feature/Whiteboards/PruneWhiteboardsTest.php
git commit -m "feat(whiteboard): workspace templates saved from a board"
```

---

### Task 5: Duplicate a board

**Files:**
- Create: `app/Actions/Whiteboards/DuplicateWhiteboard.php`, `app/Http/Controllers/Whiteboards/WhiteboardDuplicatesController.php`
- Modify: `routes/web.php`, `lang/{en,fr,de,es}.json`
- Test: `tests/Feature/Whiteboards/WhiteboardDuplicateTest.php`

**Interfaces:**
- Consumes: `CreateWhiteboard::handle(…, array $scene)`, `ReadWhiteboardScene::handle(Whiteboard): Scene` (Task 2), `WhiteboardGuard::notGuest(WhiteboardMember)` (Task 4).
- Produces: `DuplicateWhiteboard::handle(Whiteboard $board, User $user): Whiteboard`; route `POST whiteboards/{board}/duplicate` → `whiteboards.duplicate.store`, 201 `{url}` (relative URL of the copy).

The copy is in the same team, the requester facilitates it, settings are the defaults (guest access off, new guest token), the title is `:title (copy)` in the requester's language cut to 120 characters. The source is not written to and nothing is broadcast.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Whiteboards/WhiteboardDuplicateTest.php`:

```php
<?php

use App\Enums\WorkspaceRole;
use App\Events\Whiteboards\WhiteboardChanged;
use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake();
    Event::fake([WhiteboardElementsChanged::class, WhiteboardChanged::class]);
});

function storedElement(Whiteboard $board, array $data, int $seq): WhiteboardElement
{
    $element = sceneElement($data);

    return WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id,
        'element_id' => $element['id'],
        'type' => $element['type'],
        'data' => $element,
        'is_sticky' => isset($element['customData']),
        'is_deleted' => $element['isDeleted'],
        'seq' => $seq,
    ]);
}

it('duplicates a board for any member, who facilitates the copy', function () {
    $source = Whiteboard::factory()->withGuestAccess()->create(['title' => 'Discovery', 'seq' => 4, 'cursors_enabled' => false]);
    whiteboardFacilitator($source);
    [$user] = whiteboardMember($source);
    $file = WhiteboardFile::factory()->create(['whiteboard_id' => $source->id]);
    Storage::put($file->path, 'image bytes');

    storedElement($source, ['id' => 'note', 'index' => 'a1', 'customData' => ['skrum' => ['kind' => 'sticky']], 'boundElements' => [['id' => 'words', 'type' => 'text']]], 1);
    storedElement($source, ['id' => 'words', 'type' => 'text', 'text' => 'Keep me', 'originalText' => 'Keep me', 'containerId' => 'note', 'index' => 'a2'], 2);
    storedElement($source, ['id' => 'photo', 'type' => 'image', 'fileId' => $file->file_id, 'status' => 'saved', 'scale' => [1, 1], 'index' => 'a3'], 3);
    storedElement($source, ['id' => 'erased', 'index' => 'a4', 'isDeleted' => true], 4);

    $sourceChangedAt = $source->fresh()->updated_at;

    $response = $this->actingAs($user)->postJson(route('whiteboards.duplicate.store', $source))->assertCreated();

    $copy = Whiteboard::query()->whereKeyNot($source->id)->sole();
    $elements = $copy->elements()->orderBy('seq')->get();
    [$note, $words, $photo] = $elements->map(fn (WhiteboardElement $element) => $element->data)->all();

    $response->assertExactJson(['url' => route('whiteboards.show', $copy, absolute: false)]);

    expect($copy->title)->toBe('Discovery (copy)')
        ->and($copy->team_id)->toBe($source->team_id)
        ->and($copy->facilitator->user_id)->toBe($user->id)
        ->and($copy->guest_access_enabled)->toBeFalse()
        ->and($copy->cursors_enabled)->toBeTrue()
        ->and($copy->guest_token)->not->toBe($source->guest_token)
        ->and($copy->seq)->toBe(3)
        ->and($elements)->toHaveCount(3)
        ->and($elements->pluck('author_member_id')->unique()->all())->toBe([$copy->facilitator_member_id])
        ->and($elements->pluck('element_id')->intersect(['note', 'words', 'photo'])->all())->toBe([])
        ->and($elements[0]->is_sticky)->toBeTrue()
        ->and($words['containerId'])->toBe($note['id'])
        ->and($words['text'])->toBe('Keep me')
        ->and($photo['fileId'])->toBe($file->file_id)
        ->and(Storage::get("whiteboards/{$copy->id}/{$file->file_id}"))->toBe('image bytes')
        ->and($source->fresh()->seq)->toBe(4)
        ->and($source->elements()->count())->toBe(4)
        ->and($source->fresh()->updated_at->equalTo($sourceChangedAt))->toBeTrue();

    Event::assertNotDispatched(WhiteboardElementsChanged::class);
    Event::assertNotDispatched(WhiteboardChanged::class);
});

it('keeps the two boards apart afterwards', function () {
    $source = Whiteboard::factory()->create(['seq' => 1]);
    [$user] = whiteboardFacilitator($source);
    storedElement($source, ['id' => 'box', 'x' => 5], 1);

    $this->actingAs($user)->postJson(route('whiteboards.duplicate.store', $source))->assertCreated();

    $copy = Whiteboard::query()->whereKeyNot($source->id)->sole();
    $copied = $copy->elements()->sole();

    $this->actingAs($user)
        ->putJson(route('whiteboards.elements.update', $copy), ['elements' => [[...$copied->data, 'version' => 2, 'x' => 900]]])
        ->assertOk()
        ->assertJsonPath('rejected', []);

    $source->delete();

    expect($copy->elements()->sole()->data['x'])->toBe(900)
        ->and(Whiteboard::query()->count())->toBe(1);
});

it('keeps the title of the copy within 120 characters', function () {
    $source = Whiteboard::factory()->create(['title' => str_repeat('a', 120)]);
    [$user] = whiteboardFacilitator($source);

    $this->actingAs($user)->postJson(route('whiteboards.duplicate.store', $source))->assertCreated();

    $title = Whiteboard::query()->whereKeyNot($source->id)->sole()->title;

    expect(mb_strlen($title))->toBe(120)
        ->and($title)->toBe(str_repeat('a', 113).' (copy)');
});

it('refuses guests and people outside the team', function () {
    $source = Whiteboard::factory()->withGuestAccess()->create();
    $guest = whiteboardGuest($source);

    $this->withCookies(whiteboardGuestCookie($guest))->withCredentials()
        ->postJson(route('whiteboards.duplicate.store', $source))
        ->assertForbidden()
        ->assertJsonPath('message', 'Guests cannot do this.');

    $outsider = User::factory()->create();
    $source->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)->postJson(route('whiteboards.duplicate.store', $source))->assertForbidden();

    expect(Whiteboard::query()->count())->toBe(1);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards/WhiteboardDuplicateTest.php`
Expected: FAIL — `Route [whiteboards.duplicate.store] not defined`.

- [ ] **Step 3: Implement**

`app/Actions/Whiteboards/DuplicateWhiteboard.php`:

```php
<?php

namespace App\Actions\Whiteboards;

use App\Models\User;
use App\Models\Whiteboard;
use Illuminate\Support\Facades\DB;

class DuplicateWhiteboard
{
    private const MaxTitleLength = 120;

    public function __construct(
        private CreateWhiteboard $createWhiteboard,
        private ReadWhiteboardScene $readWhiteboardScene,
    ) {}

    /**
     * The source is locked while it is read, so the copy is one moment of
     * the board and not a mix of two.
     */
    public function handle(Whiteboard $board, User $user): Whiteboard
    {
        return DB::transaction(function () use ($board, $user): Whiteboard {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            return $this->createWhiteboard->handle(
                $locked->team,
                $user,
                $this->title($locked->title),
                $this->readWhiteboardScene->handle($locked),
            );
        });
    }

    private function title(string $title): string
    {
        $room = self::MaxTitleLength - mb_strlen(__(':title (copy)', ['title' => '']));

        return __(':title (copy)', ['title' => rtrim(mb_substr($title, 0, $room))]);
    }
}
```

`app/Http/Controllers/Whiteboards/WhiteboardDuplicatesController.php`:

```php
<?php

namespace App\Http\Controllers\Whiteboards;

use App\Actions\Whiteboards\DuplicateWhiteboard;
use App\Actions\Whiteboards\WhiteboardGuard;
use App\Http\Controllers\Controller;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WhiteboardDuplicatesController extends Controller
{
    public function store(Request $request, Whiteboard $board, DuplicateWhiteboard $duplicateWhiteboard): JsonResponse
    {
        WhiteboardGuard::notGuest(WhiteboardMember::current($request));

        $copy = $duplicateWhiteboard->handle($board, $request->user());

        return response()->json(['url' => route('whiteboards.show', $copy, absolute: false)], 201);
    }
}
```

In `routes/web.php` import the controller and add, after the `template` route of the board group:

```php
        Route::post('duplicate', [WhiteboardDuplicatesController::class, 'store'])->name('whiteboards.duplicate.store');
```

Add the Task 5 row of Appendix A.

- [ ] **Step 4: Run, gates, commit**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards tests/Feature/TranslationKeysTest.php`
Expected: PASS.

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/phpstan analyse --memory-limit=1G app/Actions/Whiteboards/DuplicateWhiteboard.php app/Http/Controllers/Whiteboards/WhiteboardDuplicatesController.php
git add app/Actions/Whiteboards/DuplicateWhiteboard.php app/Http/Controllers/Whiteboards/WhiteboardDuplicatesController.php routes/web.php lang/en.json lang/fr.json lang/de.json lang/es.json tests/Feature/Whiteboards/WhiteboardDuplicateTest.php
git commit -m "feat(whiteboard): duplicate a board"
```

---

### Task 6: Team page data — delete rights, templates, gallery

**Files:**
- Create: `app/Actions/Whiteboards/BuildWhiteboardGallery.php`
- Modify: `app/Actions/Whiteboards/PresentWhiteboardSummary.php`, `app/Http/Controllers/TeamsController.php`
- Test: replace `tests/Feature/Whiteboards/TeamWhiteboardsSectionTest.php`

**Interfaces:**
- Consumes: `BuiltInTemplates`, `PresentWhiteboardPreview`, `Workspace::whiteboardTemplates()`.
- Produces (Inertia props of `teams/show`):
  - `whiteboards: [{id, title, updatedAt, facilitatorName, canDelete}]`
  - `whiteboardTemplates: [{id, name, description, canManage}]` (by name; no scene)
  - `whiteboardGallery` (optional prop, loaded with `router.reload({only: ['whiteboardGallery']})`): `[{key, workspaceTemplateId, name, description, preview}]` — eight built-ins (`key` = template key, `workspaceTemplateId` null) then workspace templates (`key` = `workspace:{id}`)
  - `PresentWhiteboardSummary::handle(Whiteboard $board, User $viewer, bool $viewerManagesWorkspace): array`
  - `BuildWhiteboardGallery::handle(Workspace $workspace): list<GalleryItem>`

- [ ] **Step 1: Replace the test file**

`tests/Feature/Whiteboards/TeamWhiteboardsSectionTest.php`:

```php
<?php

use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\Whiteboard;
use App\Models\WhiteboardTemplate;
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
            ->where('whiteboards.0.canDelete', false)
            ->where('whiteboards.1.id', $older->id)
            ->where('whiteboards.1.facilitatorName', null)
            ->where('whiteboards.1.canDelete', false));
});

it('offers to delete a board to its facilitator and to workspace admins only', function () {
    $team = Team::factory()->create();
    $board = Whiteboard::factory()->create(['team_id' => $team->id]);
    [$facilitator] = whiteboardFacilitator($board);
    $orphan = Whiteboard::factory()->create(['team_id' => $team->id, 'title' => 'No facilitator']);

    $canDelete = fn ($user) => collect($this->actingAs($user)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertOk()
        ->inertiaProps('whiteboards'))->pluck('canDelete', 'id')->all();

    expect($canDelete($facilitator))->toBe([$orphan->id => false, $board->id => true])
        ->and($canDelete(teamMember($team)))->toBe([$orphan->id => false, $board->id => false])
        ->and($canDelete(workspaceManager($team->workspace)))->toBe([$orphan->id => true, $board->id => true]);
});

it('lists the workspace templates by name, without their scenes', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $mine = WhiteboardTemplate::factory()->create(['workspace_id' => $team->workspace_id, 'name' => 'Zebra', 'description' => 'Stripes', 'created_by_user_id' => $user->id]);
    $theirs = WhiteboardTemplate::factory()->create(['workspace_id' => $team->workspace_id, 'name' => 'Alpha']);
    WhiteboardTemplate::factory()->create(['name' => 'Elsewhere']);

    $this->actingAs($user)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('whiteboardTemplates', [
                ['id' => $theirs->id, 'name' => 'Alpha', 'description' => null, 'canManage' => false],
                ['id' => $mine->id, 'name' => 'Zebra', 'description' => 'Stripes', 'canManage' => true],
            ]));

    $this->actingAs(workspaceManager($team->workspace))
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('whiteboardTemplates.0.canManage', true)
            ->where('whiteboardTemplates.1.canManage', true));
});

it('loads the gallery on demand: built-in templates first, then the workspace own', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $user->forceFill(['locale' => 'de'])->save();
    $preview = ['width' => 10, 'height' => 20, 'shapes' => [['kind' => 'rect', 'x' => 0, 'y' => 0, 'width' => 10, 'height' => 20, 'fill' => null, 'stroke' => '#1e1e1e', 'points' => []]]];
    $template = WhiteboardTemplate::factory()->create([
        'workspace_id' => $team->workspace_id, 'name' => 'Ours', 'description' => 'Team format', 'preview' => $preview,
        'scene' => ['elements' => [sceneElement(['id' => 'hidden-from-the-gallery'])], 'files' => []],
    ]);
    WhiteboardTemplate::factory()->create(['name' => 'Elsewhere']);

    $this->actingAs($user)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->missing('whiteboardGallery')
            ->reloadOnly('whiteboardGallery', fn (Assert $reload) => $reload
                ->has('whiteboardGallery', 9)
                ->where('whiteboardGallery.0.key', 'blank')
                ->where('whiteboardGallery.0.name', 'Leer')
                ->where('whiteboardGallery.0.workspaceTemplateId', null)
                ->where('whiteboardGallery.0.preview', ['width' => 0, 'height' => 0, 'shapes' => []])
                ->where('whiteboardGallery.5.key', 'swot')
                ->where('whiteboardGallery.5.description', 'Stärken, Schwächen, Chancen und Risiken.')
                ->has('whiteboardGallery.5.preview.shapes', 8)
                ->where('whiteboardGallery.8', [
                    'key' => "workspace:{$template->id}",
                    'workspaceTemplateId' => $template->id,
                    'name' => 'Ours',
                    'description' => 'Team format',
                    'preview' => $preview,
                ])));
});

it('shows the team page, and so the templates, to no one outside the workspace', function () {
    $team = Team::factory()->create();
    $board = Whiteboard::factory()->withGuestAccess()->create(['team_id' => $team->id]);
    $guest = whiteboardGuest($board);

    $this->withCookies(whiteboardGuestCookie($guest))->withCredentials()
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertRedirect(route('login'));

    $this->withCookies(whiteboardGuestCookie($guest))->withCredentials()
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertOk()
        ->assertJsonMissingPath('templates')
        ->assertJsonPath('links.team', null);

    $this->actingAs(workspaceManager(Team::factory()->create()->workspace, WorkspaceRole::Owner))
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertForbidden();
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards/TeamWhiteboardsSectionTest.php`
Expected: FAIL — property `whiteboards.0.canDelete` missing.

- [ ] **Step 3: Implement**

`app/Actions/Whiteboards/PresentWhiteboardSummary.php`:

```php
<?php

namespace App\Actions\Whiteboards;

use App\Models\User;
use App\Models\Whiteboard;

class PresentWhiteboardSummary
{
    /**
     * @return array{id: string, title: string, updatedAt: ?string, facilitatorName: ?string, canDelete: bool}
     */
    public function handle(Whiteboard $board, User $viewer, bool $viewerManagesWorkspace): array
    {
        return [
            'id' => $board->id,
            'title' => $board->title,
            'updatedAt' => $board->updated_at?->toIso8601String(),
            'facilitatorName' => $board->facilitator?->displayName(),
            'canDelete' => $viewerManagesWorkspace || $board->facilitator?->user_id === $viewer->id,
        ];
    }
}
```

`app/Actions/Whiteboards/BuildWhiteboardGallery.php`:

```php
<?php

namespace App\Actions\Whiteboards;

use App\Models\WhiteboardTemplate;
use App\Models\Workspace;
use App\Support\WhiteboardTemplates\BuiltInTemplates;

/**
 * What the "New whiteboard" dialog offers: the built-in templates, then the
 * workspace's own by name. Scenes stay on the server; a tile gets a preview.
 *
 * @phpstan-import-type Preview from PresentWhiteboardPreview
 *
 * @phpstan-type GalleryItem array{
 *     key: string,
 *     workspaceTemplateId: ?string,
 *     name: string,
 *     description: ?string,
 *     preview: Preview
 * }
 */
class BuildWhiteboardGallery
{
    public function __construct(
        private BuiltInTemplates $builtInTemplates,
        private PresentWhiteboardPreview $presentWhiteboardPreview,
    ) {}

    /**
     * @return list<GalleryItem>
     */
    public function handle(Workspace $workspace): array
    {
        $builtIns = array_map(fn (string $key): array => [
            'key' => $key,
            'workspaceTemplateId' => null,
            'name' => $this->builtInTemplates->name($key),
            'description' => $this->builtInTemplates->description($key),
            'preview' => $this->presentWhiteboardPreview->handle($this->builtInTemplates->elements($key)),
        ], BuiltInTemplates::keys());

        $workspaceTemplates = $workspace->whiteboardTemplates()
            ->orderBy('name')
            ->get(['id', 'name', 'description', 'preview'])
            ->map(fn (WhiteboardTemplate $template): array => [
                'key' => "workspace:{$template->id}",
                'workspaceTemplateId' => $template->id,
                'name' => $template->name,
                'description' => $template->description,
                'preview' => $template->preview,
            ])
            ->all();

        return [...$builtIns, ...$workspaceTemplates];
    }
}
```

In `app/Http/Controllers/TeamsController.php`: import `BuildWhiteboardGallery` and `WhiteboardTemplate`; add `BuildWhiteboardGallery $buildWhiteboardGallery` as the last parameter of `show` (put each parameter on its own line); after `$canManage` add `$managesWorkspace = $request->user()->canManage($workspace);`; and replace the `whiteboards` mapper and add two props:

```php
                ->map(fn (Whiteboard $board) => $this->presentWhiteboardSummary->handle($board, $request->user(), $managesWorkspace)),
            'canCreateWhiteboard' => $request->user()->can('createWhiteboard', $team),
            'whiteboardTemplates' => $workspace->whiteboardTemplates()
                ->orderBy('name')
                ->get(['id', 'name', 'description', 'created_by_user_id'])
                ->map(fn (WhiteboardTemplate $template): array => [
                    'id' => $template->id,
                    'name' => $template->name,
                    'description' => $template->description,
                    'canManage' => $managesWorkspace || $template->created_by_user_id === $request->user()->id,
                ]),
            'whiteboardGallery' => Inertia::optional(fn () => $buildWhiteboardGallery->handle($workspace)),
```

`canDelete` mirrors `WhiteboardGuard::canDelete` (facilitator's user, or Owner/Admin); the server still decides on `DELETE`.

- [ ] **Step 4: Run, gates, commit**

Run: `DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/Whiteboards tests/Feature/Teams`
Expected: PASS.

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/phpstan analyse --memory-limit=1G app/Actions/Whiteboards/BuildWhiteboardGallery.php app/Actions/Whiteboards/PresentWhiteboardSummary.php app/Http/Controllers/TeamsController.php
git add app/Actions/Whiteboards/BuildWhiteboardGallery.php app/Actions/Whiteboards/PresentWhiteboardSummary.php app/Http/Controllers/TeamsController.php tests/Feature/Whiteboards/TeamWhiteboardsSectionTest.php
git commit -m "feat(whiteboard): team page data for templates, the gallery and board deletion"
```

---

### Task 7: Team page UI — gallery, template management, delete a board

No test runner: this task is checked by the gates and by the browser checks below. The code is a proposal; siblings to follow are `resources/js/components/teams/new-retro-dialog.tsx` (optional prop loaded on open, lines 119–124) and `saved-decks-dialog.tsx` (inline edit, confirm, `router.delete` with `onHttpException`).

**Files:**
- Create: `resources/js/components/teams/whiteboard-template-preview.tsx`, `resources/js/components/teams/whiteboard-templates-dialog.tsx`
- Modify: `resources/js/components/teams/new-whiteboard-dialog.tsx`, `resources/js/components/teams/whiteboards-section.tsx`, `resources/js/pages/teams/show.tsx`, `resources/js/types/poker.ts`, `lang/{en,fr,de,es}.json`

**Interfaces:**
- Consumes: props of Task 6; Wayfinder `TeamWhiteboardsController.store({workspace, team})`, `WorkspaceWhiteboardTemplatesController.update|destroy({workspace, whiteboardTemplate})`, `WhiteboardsController.destroy(boardId)` (run `npm run build` first so they exist); `retroRequest`, `RetroRequestError` from `@/lib/retro/api`.
- Produces: types in `resources/js/types/poker.ts` (next to `WhiteboardSummary`, which gains `canDelete: boolean`):

```ts
export type WhiteboardPreviewShape = {
    kind: 'rect' | 'ellipse' | 'diamond' | 'path' | 'text';
    x: number;
    y: number;
    width: number;
    height: number;
    fill: string | null;
    stroke: string | null;
    points: [number, number][];
};
export type WhiteboardPreview = { width: number; height: number; shapes: WhiteboardPreviewShape[] };
export type WhiteboardGalleryItem = {
    key: string;
    workspaceTemplateId: string | null;
    name: string;
    description: string | null;
    preview: WhiteboardPreview;
};
export type WhiteboardTemplateSummary = { id: string; name: string; description: string | null; canManage: boolean };
```

- [ ] **Step 1: `WhiteboardTemplatePreview`** — `({preview}: {preview: WhiteboardPreview})`. Renders `<svg viewBox="0 0 {width||1} {height||1}" preserveAspectRatio="xMidYMid meet" className="h-24 w-full" aria-hidden="true">`. Per shape, by `kind`: `rect` → `<rect>`; `ellipse` → `<ellipse cx cy rx ry>`; `diamond` → `<polygon>` through the four mid-points; `path` → `<polyline points fill="none">`; `text` → a `<rect>` of the same box with `fill="currentColor"` and `opacity={0.25}` (a bar standing for text). `fill={shape.fill ?? 'none'}`, `stroke={shape.stroke ?? 'none'}`, `strokeWidth={Math.max(width, height) / 200}`, `vectorEffect="non-scaling-stroke"` omitted. An empty preview (`shapes.length === 0`) renders the same empty SVG box. Colours are only ever hex strings or null (server-checked), and they are set as attributes, never as markup.

- [ ] **Step 2: Gallery in `NewWhiteboardDialog`** — new prop `gallery?: WhiteboardGalleryItem[]`; `DialogContent` gets `className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"`. In `NewWhiteboardForm`:
  - `useForm<{title: string; template: string | null; workspace_template_id: string | null}>({title: '', template: 'blank', workspace_template_id: null})`.
  - `useEffect(() => { if (gallery === undefined) { router.reload({ only: ['whiteboardGallery'] }); } }, [gallery]);` While undefined, show six `Skeleton` tiles (`h-36`).
  - Below the title field, a `<fieldset>` with legend `t('Template')` and a `role="radiogroup"` grid (`grid grid-cols-2 gap-3 sm:grid-cols-3`). Built-ins first; when workspace templates exist, a sub-heading `t('Workspace templates')` then their tiles. A tile is a `<button type="button" role="radio" aria-checked={selected}>` with the preview, the name (`font-medium`) and the description (`text-sm text-muted-foreground line-clamp-2`); selected tile: `ring-2 ring-primary`. Selecting sets `template = item.workspaceTemplateId ? null : item.key` and `workspace_template_id = item.workspaceTemplateId`.
  - `<InputError message={form.errors.template ?? form.errors.workspace_template_id} />` under the grid. Submit unchanged (`form.submit(TeamWhiteboardsController.store(...))`).

- [ ] **Step 3: `WhiteboardTemplatesDialog`** — `({workspaceSlug, templates}: {workspaceSlug: string; templates: WhiteboardTemplateSummary[]})`. Trigger: `<Button variant="outline">{t('Whiteboard templates')}</Button>`. Content: title, then `t('No whiteboard templates yet.')` plus the hint `t('Save a board as a template from its menu.')` when empty; otherwise a `<ul className="divide-y rounded-md border">` with name, description and, when `canManage`, "Edit" and "Delete" ghost buttons.
  - Edit swaps the row for a form (`Input` name `maxLength={80}` required, `Input` description `maxLength={300}`, labels `t('Name')`, `t('Description')`, buttons `t('Save')` / `t('Cancel')`) submitted with `router.patch(WorkspaceWhiteboardTemplatesController.update({workspace: workspaceSlug, whiteboardTemplate: id}).url, {name, description}, {preserveScroll: true, onSuccess: close, onError: (errors) => setErrors(errors)})`, errors shown with `InputError`.
  - Delete shows an inline confirm (`t('Delete this template?')`, `t('Boards already created from it are not changed.')`) then `router.delete(...destroy(...).url, {preserveScroll: true, onHttpException: () => { router.reload({ only: ['whiteboardTemplates', 'whiteboardGallery'] }); return false; }})`.

- [ ] **Step 4: `WhiteboardsSection`** — new props `templates: WhiteboardTemplateSummary[]`, `gallery?: WhiteboardGalleryItem[]`. Put "New whiteboard" and the templates dialog in one `flex flex-wrap gap-2` row (the templates button shows for everyone who sees the section). Each list row becomes `<li className="flex items-center">`: the existing `Link` gets `min-w-0 flex-1`, and when `board.canDelete` a ghost icon button (`Trash2`, `aria-label={t('Delete :title', {title: board.title})}`) opens a confirm `Dialog` reusing `t('Delete this board?')`, `t('Everything on it is removed for everyone.')`, `t('Cancel')`, `t('Delete this board')`. Confirm calls `retroRequest(WhiteboardsController.destroy(board.id))`, then `router.reload({ only: ['whiteboards'] })` and closes; on failure `toast.error(error instanceof RetroRequestError && error.status > 0 ? error.message : t('Something went wrong. Please try again.'))` and the dialog stays open.

- [ ] **Step 5: `pages/teams/show.tsx`** — add `whiteboardTemplates: WhiteboardTemplateSummary[]` and `whiteboardGallery?: WhiteboardGalleryItem[]` to `Props`, destructure, pass as `templates` and `gallery`.

- [ ] **Step 6: Translation keys** — Task 7 rows of Appendix A.

- [ ] **Step 7: Gates and commit**

Run: `npm run build && npm run types:check && npx vp check resources/js/components/teams/whiteboard-template-preview.tsx resources/js/components/teams/whiteboard-templates-dialog.tsx resources/js/components/teams/new-whiteboard-dialog.tsx resources/js/components/teams/whiteboards-section.tsx resources/js/pages/teams/show.tsx resources/js/types/poker.ts && DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: no error in these files; test PASS.

```bash
git add resources/js/components/teams/whiteboard-template-preview.tsx resources/js/components/teams/whiteboard-templates-dialog.tsx resources/js/components/teams/new-whiteboard-dialog.tsx resources/js/components/teams/whiteboards-section.tsx resources/js/pages/teams/show.tsx resources/js/types/poker.ts lang/en.json lang/fr.json lang/de.json lang/es.json
git commit -m "feat(whiteboard): template gallery, template management and board deletion on the team page"
```

**Browser checks:**
- B7.1 "New whiteboard" opens a dialog with eight tiles (Blank first and selected), each with a thumbnail, name and description; skeletons show while the gallery loads; a workspace template appears under "Workspace templates".
- B7.2 Creating from each built-in template lands on a board whose frames cannot be moved or deleted by a plain click-drag, whose sample notes can, and whose labels sit inside their shapes without clipping (check Flowchart and Impact map in French and German).
- B7.3 With the UI in French, a SWOT board shows "Forces / Faiblesses / Opportunités / Menaces".
- B7.4 The templates dialog renames, edits the description and deletes a template for its creator and for an admin; another member sees no Edit/Delete; a duplicate name shows the error under the field.
- B7.5 The trash button shows only for the facilitator and admins; confirming removes the row without a full reload; an open tab on that board shows "This board was deleted".
- B7.6 Dialog and tiles are usable at 375 px width and in the dark theme.

---

### Task 8: Board UI — duplicate, save as template, export

Proposal, not run. Checked names: `name?: string` prop of the canvas component (`node_modules/@excalidraw/excalidraw/dist/types/excalidraw/types.d.ts:442`), `UIOptions.canvasActions.export: false | ExportOpts` and `saveAsImage: boolean` (same file, 470–483), `MainMenu.DefaultItems.Export` / `SaveAsImage` already rendered in `board.tsx`.

**Files:**
- Create: `resources/js/components/whiteboard/save-template-dialog.tsx`
- Modify: `resources/js/components/whiteboard/board-menu.tsx`, `resources/js/components/whiteboard/board.tsx`, `lang/{en,fr,de,es}.json`

**Interfaces:**
- Consumes: Wayfinder `WhiteboardDuplicatesController.store(boardId)` → `{url: string}`; `WhiteboardTemplatesController.store(boardId)` with `{name, description}` → `{id, name}`; `retroRequest`, `RetroRequestError` (`errors` holds validation messages per field).
- Produces: nothing for later tasks.

- [ ] **Step 1: Export** — in `board.tsx` pass `name={state.snapshot.board.title}` to `<Excalidraw>` so exported files are named after the board. Keep the existing menu entries: "Save as image" gives PNG and SVG, "Export" saves the scene file. Do not add UI that names the library. Export uses what the browser holds (spec §10); nothing server-side.

- [ ] **Step 2: `SaveTemplateDialog`** — `({boardId, open, onOpenChange}: {boardId: string; open: boolean; onOpenChange: (open: boolean) => void})`. `Dialog` + form: title `t('Save as template')`, help `t('Everyone in the workspace can start a board from it.')`, `Input` name (required, `maxLength={80}`, label `t('Name')`), `Input` description (`maxLength={300}`, label `t('Description')`), `InputError` per field, footer `t('Cancel')` / `t('Save')` (disabled while saving). Submit:

```ts
try {
    await retroRequest(WhiteboardTemplatesController.store(boardId), { name, description: description === '' ? null : description });
    toast.success(t('Template saved.'));
    onOpenChange(false);
} catch (error) {
    if (error instanceof RetroRequestError && error.status === 422) {
        setErrors({ name: error.errors.name?.[0], description: error.errors.description?.[0] });
        return;
    }
    toast.error(error instanceof RetroRequestError && error.status > 0 ? error.message : t('Something went wrong. Please try again.'));
}
```

A failure leaves the dialog open with what was typed (spec §13). Mount the form only while `open` so state resets.

- [ ] **Step 3: Menu entries** — in `board-menu.tsx`, after the "Take control" item and before the facilitator block, for `!me.isGuest`:

```tsx
<DropdownMenuItem onSelect={duplicate}>{t('Duplicate this board')}</DropdownMenuItem>
<DropdownMenuItem onSelect={() => setSavingTemplate(true)}>{t('Save as template')}</DropdownMenuItem>
```

with `const [savingTemplate, setSavingTemplate] = useState(false)`, `<SaveTemplateDialog boardId={board.id} open={savingTemplate} onOpenChange={setSavingTemplate} />` next to the other dialogs, and

```ts
const duplicate = async () => {
    try {
        const { url } = await retroRequest<{ url: string }>(WhiteboardDuplicatesController.store(board.id));
        router.visit(url);
    } catch (error) {
        toast.error(error instanceof RetroRequestError && error.status > 0 ? error.message : t('Something went wrong. Please try again.'));
    }
};
```

Do not use the menu's `run` helper for these: it refetches the board, which neither action changes. Edits still waiting in the 300 ms batch are not in the copy; that is accepted (the server copies what it holds).

- [ ] **Step 4: Translation keys** — Task 8 rows of Appendix A.

- [ ] **Step 5: Gates and commit**

Run: `npm run build && npm run types:check && npx vp check resources/js/components/whiteboard/save-template-dialog.tsx resources/js/components/whiteboard/board-menu.tsx resources/js/components/whiteboard/board.tsx && DB_HOST=127.0.0.1 php artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: no error in these files; test PASS.

```bash
git add resources/js/components/whiteboard/save-template-dialog.tsx resources/js/components/whiteboard/board-menu.tsx resources/js/components/whiteboard/board.tsx lang/en.json lang/fr.json lang/de.json lang/es.json
git commit -m "feat(whiteboard): duplicate, save as template and named exports from the board"
```

**Browser checks:**
- B8.1 Member: board menu shows "Duplicate this board" and "Save as template"; a guest (127.0.0.1) sees neither.
- B8.2 Duplicate navigates to "<title> (copy)" with the same elements and images, the member as facilitator; editing the copy leaves the original unchanged.
- B8.3 Save as template: success toast, dialog closes, template appears in the team page gallery with a thumbnail; an existing name keeps the dialog open with the error under the name.
- B8.4 Canvas menu → "Save as image" offers PNG and SVG and the file name starts with the board title; "Export" saves a `.excalidraw` file. No library name or link appears in skrum's own UI (the documented exceptions of spec §13 aside).
- B8.5 An image placed on the board is present in the PNG export, in the duplicate and in a board created from the saved template.

---

### Task 9: Acceptance and verification

**Files:**
- Create: `docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md`
- Modify: whatever the gates show to be wrong (with a test when a server rule was missing; spec first if the spec is wrong).

**Interfaces:**
- Consumes: everything above.
- Produces: the walkthrough file replayed by the automated Chrome walkthrough after this plan.

- [ ] **Step 1: Write the walkthrough file**

Title `# Plan 17b — whiteboard templates: walkthrough`, a "Before starting" paragraph (`vendor/bin/sail artisan migrate --no-interaction`, `npm run build`, accounts and origins from `.superpowers/sdd/whiteboard-rules.md`), then these sections, each with an unticked `- [ ]` line per check, written as **Setup → Action → Expected**:

1. **Each of the eight built-in templates creates a board whose structure is locked and whose texts are in the creator's language.** Setup: member A on the team page, UI in English then French. Action: create one board per template. Expected: frames/legend/axes cannot be selected-and-moved or deleted, sample notes can; texts in the UI language; snapshot JSON shows `locked: true` on every frame. Include B7.1–B7.3, B7.6.
2. **A board saved as a workspace template gives another member a board with the same elements and images, no votes and no author data, independent afterwards.** Setup: A's board with a sticky, a shape, an arrow and an image. Action: A saves it as a template; second member (127.0.0.1) creates a board from it; both edit. Expected: same elements and image; `select author_member_id from whiteboard_elements where whiteboard_id = '<new>'` shows only the new facilitator; edits and deletion of the template or the source do not change the other. Include B7.4, B8.3, B8.5.
3. **A guest cannot list, use or save workspace templates.** Setup: guest B on 127.0.0.1. Action: open the board menu; `fetch` `POST /whiteboards/<id>/template` and `POST /whiteboards/<id>/duplicate` with the XSRF header; open the team URL. Expected: no menu entries; 403 "Guests cannot do this."; team URL redirects to login. Include B8.1.
4. **A member exports PNG, SVG and `.excalidraw` from the board.** Include B8.4.
5. **Duplicate and delete from the list.** B8.2, B7.5.
6. **Sync follow-up.** B1.1, B1.2.

End with a "Feature tests that pin these criteria" list naming `BuiltInWhiteboardTemplatesTest`, `CopyWhiteboardSceneTest`, `WhiteboardTemplatesTest`, `WhiteboardDuplicateTest`, `TeamWhiteboardsSectionTest`, `PresentWhiteboardPreviewTest`, and a note that the private-writing blocks arrive with 17d.

- [ ] **Step 2: Full gates**

```bash
vendor/bin/pint --dirty --format agent
DB_HOST=127.0.0.1 php -d memory_limit=-1 vendor/bin/pest --compact
composer lint
npm run build && npm run types:check
npx vp check resources/js/lib/whiteboard resources/js/components/whiteboard resources/js/components/teams/whiteboard-template-preview.tsx resources/js/components/teams/whiteboard-templates-dialog.tsx resources/js/components/teams/new-whiteboard-dialog.tsx resources/js/components/teams/whiteboards-section.tsx resources/js/pages/teams/show.tsx
vendor/bin/sail artisan migrate --no-interaction
```

Expected: the suite passes; PHPStan/Pint clean; `types:check` shows only the known `manage-passkeys.tsx` error; no `vp check` failure in the listed files. Also confirm `git diff 794d0f2 -- package.json composer.json` is empty (no new dependency).

- [ ] **Step 3: Fix what the gates show**, re-run the affected gate, and record each fix in the report.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md
git commit -m "docs(whiteboard): walkthrough for templates, duplicate and export"
```

(Add any fixed file by its explicit path to the same or a separate commit.)

---

## Appendix A — Translation keys

Add each key to `lang/en.json` (value = key) and the three others. Run `grep -n '"<key>"' lang/fr.json` first; rows marked "exists" must not be duplicated.

| Task | Key (English) | French | German | Spanish |
|---|---|---|---|---|
| 4 | This workspace already has 50 whiteboard templates. | Cet espace de travail a déjà 50 modèles de tableau blanc. | Dieser Workspace hat bereits 50 Whiteboard-Vorlagen. | Este espacio de trabajo ya tiene 50 plantillas de pizarra. |
| 4 | Choose either a built-in template or a workspace template. | Choisissez soit un modèle intégré, soit un modèle de l'espace de travail. | Wählen Sie entweder eine integrierte Vorlage oder eine Workspace-Vorlage. | Elige una plantilla integrada o una plantilla del espacio de trabajo. |
| 4 | Choose a template of this workspace. | Choisissez un modèle de cet espace de travail. | Wählen Sie eine Vorlage dieses Workspace. | Elige una plantilla de este espacio de trabajo. |
| 4 | Only the creator of this template or a workspace admin can change it. | Seul le créateur de ce modèle ou un administrateur de l'espace peut le modifier. | Nur der Ersteller dieser Vorlage oder ein Workspace-Admin kann sie ändern. | Solo el creador de esta plantilla o un administrador del espacio puede modificarla. |
| 4 | Guests cannot do this. | exists | exists | exists |
| 4 | A template with this name already exists. | exists | exists | exists |
| 5 | :title (copy) | :title (copie) | :title (Kopie) | :title (copia) |
| 7 | Template | exists | exists | exists |
| 7 | Workspace templates | Modèles de l'espace de travail | Workspace-Vorlagen | Plantillas del espacio de trabajo |
| 7 | Whiteboard templates | Modèles de tableau blanc | Whiteboard-Vorlagen | Plantillas de pizarra |
| 7 | No whiteboard templates yet. | Aucun modèle de tableau blanc pour l'instant. | Noch keine Whiteboard-Vorlagen. | Aún no hay plantillas de pizarra. |
| 7 | Save a board as a template from its menu. | Enregistrez un tableau comme modèle depuis son menu. | Speichern Sie ein Board über sein Menü als Vorlage. | Guarda una pizarra como plantilla desde su menú. |
| 7 | Delete this template? | Supprimer ce modèle ? | Diese Vorlage löschen? | ¿Eliminar esta plantilla? |
| 7 | Boards already created from it are not changed. | Les tableaux déjà créés à partir de ce modèle ne sont pas modifiés. | Bereits daraus erstellte Boards werden nicht verändert. | Las pizarras ya creadas a partir de ella no cambian. |
| 7 | Delete :title | Supprimer :title | :title löschen | Eliminar :title |
| 7 | Name, Description, Edit, Delete, Save, Cancel, Delete this board, Delete this board?, Everything on it is removed for everyone., Something went wrong. Please try again. | exist | exist | exist |
| 8 | Duplicate this board | Dupliquer ce tableau | Dieses Board duplizieren | Duplicar esta pizarra |
| 8 | Save as template | Enregistrer comme modèle | Als Vorlage speichern | Guardar como plantilla |
| 8 | Everyone in the workspace can start a board from it. | Tous les membres de l'espace de travail peuvent créer un tableau à partir de ce modèle. | Alle im Workspace können daraus ein Board starten. | Todas las personas del espacio pueden crear una pizarra a partir de ella. |
| 8 | Template saved. | exists | exists | exists |

Texts of the built-in scenes are not in this table: they are the four `lang/*/whiteboards.php` files of Task 3.
