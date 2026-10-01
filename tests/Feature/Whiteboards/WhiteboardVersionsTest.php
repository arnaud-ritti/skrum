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
