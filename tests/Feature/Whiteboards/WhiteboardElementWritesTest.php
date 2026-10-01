<?php

use App\Actions\Whiteboards\WriteWhiteboardElements;
use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;

beforeEach(function () {
    Event::fake([WhiteboardElementsChanged::class]);
});

function writeElements(mixed $test, Whiteboard $board, array $elements): mixed
{
    return $test->putJson(route('whiteboards.elements.update', $board), ['elements' => $elements]);
}

it('stores new elements, stamps the author and bumps the seq', function () {
    $board = Whiteboard::factory()->create();
    [$user, $member] = whiteboardMember($board);
    $first = sceneElement(['id' => 'first', 'authorMemberId' => 'forged']);
    $second = sceneElement(['id' => 'second']);

    writeElements($this->actingAs($user), $board, [$first, $second])
        ->assertOk()
        ->assertExactJson(['seq' => 2, 'fromSeq' => 0, 'rejected' => []]);

    $stored = $board->elements()->orderBy('seq')->get();

    expect($board->fresh()->seq)->toBe(2)
        ->and($stored->pluck('element_id')->all())->toBe(['first', 'second'])
        ->and($stored->pluck('seq')->all())->toBe([1, 2])
        ->and($stored[0]->author_member_id)->toBe($member->id)
        ->and($stored[0]->data)->not->toHaveKey('authorMemberId')
        ->and($stored[0]->version)->toBe(1)
        ->and($stored[0]->version_nonce)->toBe(100);

    Event::assertDispatched(WhiteboardElementsChanged::class, fn (WhiteboardElementsChanged $event) => $event->boardId === $board->id
        && $event->seq === 2
        && $event->fromSeq === 0
        && count($event->elements ?? []) === 2);
});

it('accepts a higher version and keeps the first author', function () {
    $board = Whiteboard::factory()->create(['seq' => 1]);
    [, $author] = whiteboardMember($board);
    [$editor] = whiteboardMember($board);
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'box', 'author_member_id' => $author->id]);

    writeElements($this->actingAs($editor), $board, [sceneElement(['id' => 'box', 'version' => 2, 'x' => 99])])
        ->assertOk()
        ->assertJsonPath('seq', 2)
        ->assertJsonPath('rejected', []);

    $stored = $board->elements()->sole();

    expect($stored->version)->toBe(2)
        ->and($stored->data['x'])->toBe(99)
        ->and($stored->author_member_id)->toBe($author->id);
});

it('rejects a stale version and returns the server copy', function () {
    $board = Whiteboard::factory()->create(['seq' => 5]);
    [$user] = whiteboardMember($board);
    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id, 'element_id' => 'box', 'version' => 3, 'version_nonce' => 50,
        'data' => sceneElement(['id' => 'box', 'version' => 3, 'versionNonce' => 50, 'x' => 7]),
    ]);

    writeElements($this->actingAs($user), $board, [sceneElement(['id' => 'box', 'version' => 2, 'x' => 99])])
        ->assertOk()
        ->assertJsonPath('seq', 5)
        ->assertJsonPath('fromSeq', 5)
        ->assertJsonPath('rejected.0.id', 'box')
        ->assertJsonPath('rejected.0.reason', 'stale')
        ->assertJsonPath('rejected.0.element.x', 7);

    Event::assertNotDispatched(WhiteboardElementsChanged::class);
});

it('breaks a version tie with the lower nonce', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id, 'element_id' => 'box', 'version' => 2, 'version_nonce' => 50,
        'data' => sceneElement(['id' => 'box', 'version' => 2, 'versionNonce' => 50, 'x' => 1]),
    ]);

    writeElements($this->actingAs($user), $board, [sceneElement(['id' => 'box', 'version' => 2, 'versionNonce' => 60, 'x' => 2])])
        ->assertJsonPath('rejected.0.reason', 'stale')
        ->assertJsonPath('rejected.0.element.x', 1);

    writeElements($this->actingAs($user), $board, [sceneElement(['id' => 'box', 'version' => 2, 'versionNonce' => 40, 'x' => 3])])
        ->assertJsonPath('rejected', []);

    expect($board->elements()->sole()->data['x'])->toBe(3);
});

it('treats a replayed batch as already applied', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    $batch = [sceneElement(['id' => 'box'])];

    writeElements($this->actingAs($user), $board, $batch)->assertJsonPath('seq', 1);

    Event::fake([WhiteboardElementsChanged::class]);

    writeElements($this->actingAs($user), $board, $batch)
        ->assertOk()
        ->assertExactJson(['seq' => 1, 'fromSeq' => 1, 'rejected' => []]);

    expect($board->fresh()->seq)->toBe(1);
    Event::assertNotDispatched(WhiteboardElementsChanged::class);
});

it('saves the good elements of a batch that holds bad ones', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    writeElements($this->actingAs($user), $board, [
        sceneElement(['id' => 'good']),
        'not an element',
        sceneElement(['id' => 'frame', 'type' => 'iframe']),
        sceneElement(['id' => 'heavy', 'type' => 'freedraw', 'points' => array_fill(0, 9000, [1.123456, 2.123456])]),
        sceneElement(['id' => 'linked', 'link' => 'javascript:alert(1)']),
    ])
        ->assertOk()
        ->assertJsonPath('seq', 2)
        ->assertJsonCount(3, 'rejected')
        ->assertJsonPath('rejected.0', ['id' => null, 'reason' => 'invalid', 'element' => null])
        ->assertJsonPath('rejected.1.id', 'frame')
        ->assertJsonPath('rejected.2.id', 'heavy');

    expect($board->elements()->pluck('element_id')->sort()->values()->all())->toBe(['good', 'linked'])
        ->and($board->elements()->where('element_id', 'linked')->sole()->data['link'])->toBeNull();
});

it('stores text exactly as typed', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    writeElements($this->actingAs($user), $board, [
        sceneElement(['id' => 'note', 'type' => 'text', 'text' => "  padded  \n", 'originalText' => '']),
    ])->assertJsonPath('rejected', []);

    $data = $board->elements()->sole()->data;

    expect($data['text'])->toBe("  padded  \n")
        ->and($data['originalText'])->toBe('');
});

it('records deletions as tombstones and flags sticky notes', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    writeElements($this->actingAs($user), $board, [
        sceneElement(['id' => 'sticky', 'customData' => ['skrum' => ['kind' => 'sticky']]]),
    ]);
    writeElements($this->actingAs($user), $board, [
        sceneElement(['id' => 'sticky', 'version' => 2, 'isDeleted' => true, 'customData' => ['skrum' => ['kind' => 'sticky']]]),
    ])->assertJsonPath('rejected', []);

    $stored = $board->elements()->sole();

    expect($stored->is_sticky)->toBeTrue()
        ->and($stored->is_deleted)->toBeTrue();
});

it('only lets the facilitator lock, unlock or change a locked element', function () {
    $board = Whiteboard::factory()->create();
    [$facilitator] = whiteboardFacilitator($board);
    [$member] = whiteboardMember($board);

    writeElements($this->actingAs($member), $board, [sceneElement(['id' => 'mine', 'locked' => true])])
        ->assertJsonPath('rejected.0.reason', 'locked')
        ->assertJsonPath('rejected.0.element', null);

    writeElements($this->actingAs($facilitator), $board, [sceneElement(['id' => 'frame', 'locked' => true])])
        ->assertJsonPath('rejected', []);

    writeElements($this->actingAs($member), $board, [sceneElement(['id' => 'frame', 'version' => 2, 'locked' => false, 'x' => 500])])
        ->assertJsonPath('rejected.0.reason', 'locked')
        ->assertJsonPath('rejected.0.element.locked', true);

    writeElements($this->actingAs($facilitator), $board, [sceneElement(['id' => 'frame', 'version' => 2, 'locked' => false])])
        ->assertJsonPath('rejected', []);

    expect($board->elements()->where('element_id', 'mine')->exists())->toBeFalse();
});

it('refuses new elements on a full board but still accepts edits and deletions', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'old']);

    $write = app(WriteWhiteboardElements::class);
    $write->maxLiveElements = 1;

    writeElements($this->actingAs($user), $board, [
        sceneElement(['id' => 'new']),
        sceneElement(['id' => 'old', 'version' => 2, 'x' => 5]),
    ])
        ->assertJsonCount(1, 'rejected')
        ->assertJsonPath('rejected.0', ['id' => 'new', 'reason' => 'full', 'element' => null]);

    writeElements($this->actingAs($user), $board, [
        sceneElement(['id' => 'old', 'version' => 3, 'isDeleted' => true]),
        sceneElement(['id' => 'newer']),
    ])->assertJsonPath('rejected', []);
});

it('validates the envelope', function (array $payload) {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    $this->actingAs($user)
        ->putJson(route('whiteboards.elements.update', $board), $payload)
        ->assertJsonValidationErrors('elements');
})->with([
    'missing' => [[]],
    'empty' => [['elements' => []]],
    'not a list' => [['elements' => 'all of them']],
    'too many' => [['elements' => array_fill(0, 201, ['id' => 'x'])]],
]);

it('lets guests write and refuses outsiders', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    $guest = whiteboardGuest($board);

    writeElements($this->withCookies(whiteboardGuestCookie($guest))->withCredentials(), $board, [sceneElement(['id' => 'guest'])])
        ->assertOk();

    expect($board->elements()->sole()->author_member_id)->toBe($guest->id);

    $board->update(['guest_access_enabled' => false]);

    writeElements($this->withCookies(whiteboardGuestCookie($guest))->withCredentials(), $board, [sceneElement(['id' => 'late'])])
        ->assertForbidden();

    expect($board->elements()->count())->toBe(1);
});

it('sends ids only when the payload is too big for one message', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    $stroke = sceneElement(['id' => 'stroke', 'type' => 'freedraw', 'points' => array_fill(0, 600, [1.123456, 2.123456])]);

    writeElements($this->actingAs($user), $board, [$stroke])->assertJsonPath('rejected', []);

    Event::assertDispatched(WhiteboardElementsChanged::class, fn (WhiteboardElementsChanged $event) => $event->elements === null
        && $event->broadcastWith() === ['seq' => 1, 'fromSeq' => 0]);
});

it('throttles writes with the whiteboard limiter', function () {
    expect(Route::getRoutes()->getByName('whiteboards.elements.update')->gatherMiddleware())
        ->toContain('throttle:whiteboard-writes');
});
