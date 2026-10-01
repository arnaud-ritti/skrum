<?php

use App\Actions\Whiteboards\WriteWhiteboardElements;
use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
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

it('answers 200 and saves the rest when an element would not fit the columns or would break the canvas', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    writeElements($this->actingAs($user), $board, [
        sceneElement(['id' => 'good']),
        sceneElement(['id' => 'huge', 'version' => 3_000_000_000]),
        sceneElement(['id' => 'pointless', 'type' => 'line']),
        sceneElement(['id' => 'also-good']),
    ])
        ->assertOk()
        ->assertJsonPath('seq', 2)
        ->assertJsonCount(2, 'rejected')
        ->assertJsonPath('rejected.0', ['id' => 'huge', 'reason' => 'invalid', 'element' => null])
        ->assertJsonPath('rejected.1', ['id' => 'pointless', 'reason' => 'invalid', 'element' => null]);

    expect($board->elements()->pluck('element_id')->sort()->values()->all())->toBe(['also-good', 'good']);
});

it('returns the server copy with an invalid rejection of an element it already holds', function () {
    $board = Whiteboard::factory()->create(['seq' => 4]);
    [$user] = whiteboardMember($board);
    $note = sceneElement(['id' => 'note', 'type' => 'text', 'text' => 'short', 'originalText' => 'short', 'version' => 3]);
    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id, 'element_id' => 'note', 'type' => 'text', 'version' => 3, 'version_nonce' => 100, 'data' => $note,
    ]);

    writeElements($this->actingAs($user), $board, [
        [...$note, 'version' => 4, 'text' => str_repeat('a', 10_001)],
        sceneElement(['id' => 'unknown', 'type' => 'iframe']),
    ])
        ->assertOk()
        ->assertJsonPath('seq', 4)
        ->assertJsonCount(2, 'rejected')
        ->assertJsonPath('rejected.0.id', 'note')
        ->assertJsonPath('rejected.0.reason', 'invalid')
        ->assertJsonPath('rejected.0.element', $note)
        ->assertJsonPath('rejected.1', ['id' => 'unknown', 'reason' => 'invalid', 'element' => null]);

    expect($board->elements()->sole()->data['text'])->toBe('short');

    Event::assertNotDispatched(WhiteboardElementsChanged::class);
});

it('broadcasts the accepted elements in the order of their index', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    writeElements($this->actingAs($user), $board, [
        sceneElement(['id' => 'top', 'index' => 'a2']),
        sceneElement(['id' => 'bottom', 'index' => 'Zz']),
        sceneElement(['id' => 'middle', 'index' => 'a1']),
    ])->assertJsonPath('rejected', []);

    Event::assertDispatched(WhiteboardElementsChanged::class, fn (WhiteboardElementsChanged $event) => array_column($event->elements ?? [], 'id') === ['bottom', 'middle', 'top']);
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

it('brings a deleted element back when it is written live again', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    writeElements($this->actingAs($user), $board, [sceneElement(['id' => 'box'])]);
    writeElements($this->actingAs($user), $board, [sceneElement(['id' => 'box', 'version' => 2, 'isDeleted' => true])]);

    writeElements($this->actingAs($user), $board, [sceneElement(['id' => 'box', 'version' => 3])])
        ->assertOk()
        ->assertJsonPath('rejected', []);

    $stored = $board->elements()->sole();

    expect($stored->is_deleted)->toBeFalse()
        ->and($stored->version)->toBe(3);
});

it('refuses to bring a deleted element back on a full board', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'live']);
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'gone', 'is_deleted' => true]);

    $write = app(WriteWhiteboardElements::class);
    $write->maxLiveElements = 1;

    writeElements($this->actingAs($user), $board, [sceneElement(['id' => 'gone', 'version' => 2])])
        ->assertJsonPath('rejected.0.id', 'gone')
        ->assertJsonPath('rejected.0.reason', 'full');

    expect($board->elements()->where('element_id', 'gone')->sole()->is_deleted)->toBeTrue();
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

it('rejects a guest who deletes, moves or unlocks a locked element and hands back the stored copy', function (array $change) {
    $board = Whiteboard::factory()->withGuestAccess()->create(['seq' => 1]);
    whiteboardFacilitator($board);
    $guest = whiteboardGuest($board);
    $frame = sceneElement(['id' => 'frame', 'locked' => true, 'x' => 7]);
    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id, 'element_id' => 'frame', 'version_nonce' => 100, 'data' => $frame,
    ]);

    writeElements($this->withCookies(whiteboardGuestCookie($guest))->withCredentials(), $board, [[...$frame, 'version' => 2, ...$change]])
        ->assertOk()
        ->assertJsonPath('seq', 1)
        ->assertJsonPath('rejected.0.reason', 'locked')
        ->assertJsonPath('rejected.0.element', $frame);

    $stored = $board->elements()->sole();

    expect($stored->data)->toEqual($frame)
        ->and($stored->is_deleted)->toBeFalse();

    Event::assertNotDispatched(WhiteboardElementsChanged::class);
})->with([
    'delete' => [['isDeleted' => true]],
    'move' => [['x' => 500]],
    'unlock' => [['locked' => false]],
]);

it('accepts a second write of an element whose id is 0', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    putWhiteboardElements($this->actingAs($user), $board, [sceneElement(['id' => '0'])])->assertOk()->assertJsonPath('rejected', []);
    putWhiteboardElements($this->actingAs($user), $board, [sceneElement(['id' => '0', 'version' => 2, 'x' => 5])])
        ->assertOk()
        ->assertJsonPath('rejected', []);

    expect($board->elements()->sole()->data['x'])->toBe(5);
});

it('queues no job for an element write', function () {
    Queue::fake();

    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    writeElements($this->actingAs($user), $board, [sceneElement(['id' => 'first'])])->assertOk();

    Queue::assertNothingPushed();
});
