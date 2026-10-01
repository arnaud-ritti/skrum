<?php

use App\Actions\Whiteboards\CreateWhiteboard;
use App\Models\Team;
use App\Models\Whiteboard;
use App\Models\WhiteboardVersion;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

it('starts a board with nothing versioned', function () {
    $board = Whiteboard::factory()->create()->fresh();

    expect($board->last_versioned_seq)->toBe(0)
        ->and($board->versions()->count())->toBe(0);
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

it('starts a board made from a scene with nothing left to version', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $board = app(CreateWhiteboard::class)->handle($team, $user, 'From a scene', [
        'elements' => [sceneElement(['id' => 'first']), sceneElement(['id' => 'second', 'index' => 'a1'])],
        'files' => [],
    ]);

    expect($board->fresh()->seq)->toBe(2)
        ->and($board->fresh()->last_versioned_seq)->toBe(2);
});
