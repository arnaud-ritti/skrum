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

it('names the version stored before a restore with the date and no clock time', function () {
    $this->travelTo('2026-10-12 15:28:00');
    [$board, $facilitator, $version] = boardWithHistory();

    restoreVersion($this->actingAs($facilitator), $board, $version)->assertNoContent();

    expect($board->versions()->whereKeyNot($version->id)->sole()->name)->toBe('Before restore · October 12, 2026');
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

it('only lets the facilitator restore', function () {
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

it('refuses to copy a version for guests and outsiders', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    whiteboardFacilitator($board);
    $guest = whiteboardGuest($board);
    [$note, $text] = stickyWithText('note', 'Kept in history');
    $version = WhiteboardVersion::factory()->create([
        'whiteboard_id' => $board->id,
        'scene' => ['elements' => [$note, $text], 'fileIds' => []],
    ]);
    $copyUrl = route('whiteboards.versions.copy.store', [$board, $version]);

    whiteboardViewer($this, $guest)->postJson($copyUrl)
        ->assertForbidden()
        ->assertJsonPath('message', 'Guests cannot do this.');

    $outsider = User::factory()->create();
    $board->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)->postJson($copyUrl)->assertForbidden();

    expect(Whiteboard::query()->count())->toBe(1);
});
