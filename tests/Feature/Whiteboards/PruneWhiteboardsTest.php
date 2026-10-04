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

it('leaves the board where it was in the team list when it purges', function () {
    $this->travelTo(now()->subDays(3));
    $board = Whiteboard::factory()->create(['seq' => 4]);
    WhiteboardElement::factory()->deleted()->create(['whiteboard_id' => $board->id, 'seq' => 4]);
    $this->travelBack();

    $lastChange = $board->fresh()->updated_at;

    $this->artisan('skrum:prune-whiteboards')->assertSuccessful();

    expect($board->fresh()->purged_seq)->toBe(4)
        ->and($board->fresh()->updated_at->equalTo($lastChange))->toBeTrue();
});

it('never lowers the purge mark', function () {
    $board = Whiteboard::factory()->create(['seq' => 9, 'purged_seq' => 8]);

    $this->travelTo(now()->subHours(25));
    WhiteboardElement::factory()->deleted()->create(['whiteboard_id' => $board->id, 'seq' => 3]);
    $this->travelBack();

    $this->artisan('skrum:prune-whiteboards')->assertSuccessful();

    expect($board->fresh()->purged_seq)->toBe(8);
});

it('deletes day-old images no element or recent tombstone uses and the folders of gone boards', function () {
    Storage::fake();

    $board = Whiteboard::factory()->create();

    $this->travelTo(now()->subHours(25));
    $used = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);
    $unused = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);
    $ofDeleted = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);
    $ofRecentlyDeleted = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);
    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id,
        'type' => 'image',
        'is_deleted' => true,
        'data' => sceneElement(['type' => 'image', 'fileId' => $ofDeleted->file_id, 'isDeleted' => true]),
    ]);
    $this->travelBack();

    $fresh = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);

    foreach ([$used, $unused, $ofDeleted, $ofRecentlyDeleted, $fresh] as $file) {
        Storage::put($file->path, 'bytes');
    }

    Storage::put('whiteboards/00000000-0000-0000-0000-000000000000/orphan', 'bytes');
    touch(Storage::path('whiteboards/00000000-0000-0000-0000-000000000000/orphan'), now()->subDays(2)->getTimestamp());
    Storage::put('whiteboards/00000000-0000-0000-0000-000000000009/being-copied', 'bytes');

    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id,
        'type' => 'image',
        'data' => sceneElement(['type' => 'image', 'fileId' => $used->file_id]),
    ]);
    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id,
        'type' => 'image',
        'is_deleted' => true,
        'data' => sceneElement(['type' => 'image', 'fileId' => $ofRecentlyDeleted->file_id, 'isDeleted' => true]),
    ]);

    $this->artisan('skrum:prune-whiteboards')->assertSuccessful();

    expect(WhiteboardFile::query()->pluck('id')->sort()->values()->all())
        ->toBe(collect([$used->id, $ofRecentlyDeleted->id, $fresh->id])->sort()->values()->all());

    Storage::assertExists($used->path);
    Storage::assertExists($fresh->path);
    Storage::assertMissing($unused->path);
    Storage::assertMissing($ofDeleted->path);
    Storage::assertExists($ofRecentlyDeleted->path);
    Storage::assertMissing('whiteboards/00000000-0000-0000-0000-000000000000/orphan');
    Storage::assertExists('whiteboards/00000000-0000-0000-0000-000000000009/being-copied');
});

it('leaves folders that are not a board alone', function () {
    Storage::fake();
    Storage::put('whiteboards/not-a-board/file', 'bytes');

    $this->artisan('skrum:prune-whiteboards')->assertSuccessful();

    Storage::assertExists('whiteboards/not-a-board/file');
});
