<?php

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
