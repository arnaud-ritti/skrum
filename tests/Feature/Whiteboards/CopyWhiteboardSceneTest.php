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

    $board = resolve(CreateWhiteboard::class)->handle($team, teamMember($team), 'Copy', ['elements' => $elements, 'files' => $files]);

    return [$board, $board->elements()->orderBy('seq')->get()->map(fn (WhiteboardElement $element): array => $element->data)];
}

it('gives five thousand valid indices in the order the canvas compares them', function () {
    $indexes = resolve(GenerateFractionalIndexes::class)->handle(5000);
    $sorted = $indexes;
    sort($sorted, SORT_STRING);

    expect($indexes)->toBe($sorted)
        ->and(array_unique($indexes))->toHaveCount(5000)
        ->and($indexes[0])->toBe('a0')
        ->and($indexes[61])->toBe('az')
        ->and($indexes[62])->toBe('b00')
        ->and($indexes[3905])->toBe('bzz')
        ->and($indexes[3906])->toBe('c000');

    $sanitize = resolve(SanitizeWhiteboardElement::class);

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
    $sanitize = resolve(SanitizeWhiteboardElement::class);

    expect($copies->pluck('id')->intersect(['frame', 'box', 'label', 'target', 'link'])->all())->toBeEmpty()
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

it('leaves out an image whose copy fails', function () {
    $disk = Storage::fake();

    $source = Whiteboard::factory()->create();
    $file = WhiteboardFile::factory()->create(['whiteboard_id' => $source->id]);
    Storage::put($file->path, 'bytes');

    Storage::set(config('filesystems.default'), Mockery::mock($disk)->shouldReceive('copy')->andReturn(false)->getMock());

    [$board, $copies] = boardFromScene([
        sceneElement(['id' => 'picture', 'type' => 'image', 'fileId' => $file->file_id, 'status' => 'saved', 'scale' => [1, 1]]),
        sceneElement(['id' => 'box']),
    ], [['fileId' => $file->file_id, 'path' => $file->path, 'mimeType' => $file->mime_type, 'size' => $file->size]]);

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

    $scene = resolve(ReadWhiteboardScene::class)->handle($board);

    expect(array_column($scene['elements'], 'id'))->toBe(['back', 'front'])
        ->and($scene['files'])->toBe([[
            'fileId' => $shown->file_id, 'path' => $shown->path, 'mimeType' => $shown->mime_type, 'size' => $shown->size,
        ]]);
});
