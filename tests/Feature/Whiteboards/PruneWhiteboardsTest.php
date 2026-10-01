<?php

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;
use Illuminate\Support\Facades\Storage;

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
