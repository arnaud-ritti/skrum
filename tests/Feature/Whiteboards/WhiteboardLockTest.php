<?php

use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake();
    Event::fake([WhiteboardElementsChanged::class]);
});

/**
 * A locked board holding one box, its facilitator and another member.
 *
 * @return array{0: Whiteboard, 1: User, 2: User}
 */
function lockedBoard(): array
{
    $board = Whiteboard::factory()->withGuestAccess()->create(['locked' => true, 'seq' => 1]);
    [$facilitator] = whiteboardFacilitator($board);
    [$member] = whiteboardMember($board);

    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id,
        'element_id' => 'box',
        'version_nonce' => 100,
        'data' => sceneElement(['id' => 'box', 'x' => 7]),
    ]);

    return [$board, $facilitator, $member];
}

/**
 * @return array{elements: list<array<string, mixed>>}
 */
function lockedBoardEdit(): array
{
    return ['elements' => [sceneElement(['id' => 'box', 'version' => 2, 'x' => 99]), sceneElement(['id' => 'new'])]];
}

it('refuses element writes from a member and a guest on a locked board', function () {
    [$board, , $member] = lockedBoard();
    $guest = whiteboardGuest($board);

    $this->withCookies(whiteboardGuestCookie($guest))->withCredentials()
        ->putJson(route('whiteboards.elements.update', $board), lockedBoardEdit())
        ->assertForbidden()
        ->assertJsonPath('message', 'This board is locked.')
        ->assertJsonPath('errors.locked.0', 'This board is locked.');

    $this->actingAs($member)
        ->putJson(route('whiteboards.elements.update', $board), lockedBoardEdit())
        ->assertForbidden()
        ->assertJsonPath('message', 'This board is locked.')
        ->assertJsonPath('errors.locked.0', 'This board is locked.');

    expect($board->fresh()->seq)->toBe(1)
        ->and($board->elements()->sole()->data['x'])->toBe(7);

    Event::assertNotDispatched(WhiteboardElementsChanged::class);
});

it('lets the facilitator keep editing a locked board', function () {
    [$board, $facilitator] = lockedBoard();

    $this->actingAs($facilitator)
        ->putJson(route('whiteboards.elements.update', $board), lockedBoardEdit())
        ->assertOk()
        ->assertExactJson(['seq' => 3, 'fromSeq' => 1, 'rejected' => []]);

    expect($board->elements()->where('element_id', 'box')->sole()->data['x'])->toBe(99)
        ->and($board->elements()->count())->toBe(2);
});

it('refuses uploads on a locked board, except the facilitator\'s', function () {
    [$board, $facilitator, $member] = lockedBoard();

    $upload = fn (mixed $test) => $test->post(
        route('whiteboards.files.store', $board),
        ['file' => UploadedFile::fake()->image('photo.png', 20, 20), 'file_id' => 'abc123'],
        ['Accept' => 'application/json'],
    );

    $upload($this->actingAs($member))
        ->assertForbidden()
        ->assertJsonPath('errors.locked.0', 'This board is locked.');

    expect(WhiteboardFile::query()->count())->toBe(0)
        ->and(Storage::allFiles())->toBeEmpty();

    $upload($this->actingAs($facilitator))->assertCreated();

    expect(WhiteboardFile::query()->count())->toBe(1);
});

it('still lets everyone read a locked board', function () {
    [$board, , $member] = lockedBoard();
    $file = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);
    Storage::put($file->path, 'image bytes');

    $this->actingAs($member)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertOk()
        ->assertJsonPath('board.locked', true)
        ->assertJsonCount(1, 'elements');

    $this->actingAs($member)
        ->getJson(route('whiteboards.elements.index', [$board, 'since' => 0]))
        ->assertOk()
        ->assertJsonCount(1, 'elements');

    $this->actingAs($member)
        ->get(route('whiteboards.files.show', [$board, $file->file_id]))
        ->assertOk();
});

it('follows the facilitator role, not the person, when control changes', function () {
    [$board, $facilitator, $member] = lockedBoard();

    $this->actingAs($member)
        ->putJson(route('whiteboards.facilitator.update', $board), ['user_id' => $member->id])
        ->assertNoContent();

    expect($board->fresh()->locked)->toBeTrue();

    $this->actingAs($member)
        ->putJson(route('whiteboards.elements.update', $board), lockedBoardEdit())
        ->assertOk()
        ->assertJsonPath('rejected', []);

    $this->actingAs($facilitator)
        ->putJson(route('whiteboards.elements.update', $board), ['elements' => [sceneElement(['id' => 'box', 'version' => 3, 'x' => 1])]])
        ->assertForbidden()
        ->assertJsonPath('errors.locked.0', 'This board is locked.');

    expect($board->elements()->where('element_id', 'box')->sole()->data['x'])->toBe(99);
});

it('gives everyone their pen back when the board is unlocked', function () {
    [$board, $facilitator, $member] = lockedBoard();

    $this->actingAs($facilitator)
        ->patchJson(route('whiteboards.settings.update', $board), ['locked' => false])
        ->assertNoContent();

    $this->actingAs($member)
        ->putJson(route('whiteboards.elements.update', $board), lockedBoardEdit())
        ->assertOk()
        ->assertJsonPath('rejected', []);
});

it('keeps duplicate and save as template open to members of a locked board', function () {
    [$board, , $member] = lockedBoard();

    $this->actingAs($member)->postJson(route('whiteboards.duplicate.store', $board))->assertCreated();
    $this->actingAs($member)->postJson(route('whiteboards.template.store', $board), ['name' => 'Locked'])->assertCreated();

    expect(Whiteboard::query()->whereKeyNot($board->id)->sole()->locked)->toBeFalse();
});
