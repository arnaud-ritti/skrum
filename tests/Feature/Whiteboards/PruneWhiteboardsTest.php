<?php

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
