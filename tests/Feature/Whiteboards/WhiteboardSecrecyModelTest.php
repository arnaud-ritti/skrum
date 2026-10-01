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
