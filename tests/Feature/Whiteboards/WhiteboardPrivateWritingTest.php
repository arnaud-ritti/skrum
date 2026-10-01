<?php

use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake([WhiteboardElementsChanged::class]);
});

/**
 * What every `elements.changed` of the test put on the wire.
 *
 * @return list<array<string, mixed>>
 */
function elementsChangedPayloads(): array
{
    return Event::dispatched(WhiteboardElementsChanged::class)
        ->map(fn (array $arguments): array => $arguments[0]->broadcastWith())
        ->values()
        ->all();
}

/**
 * @return array<string, bool>
 */
function privateFlags(Whiteboard $board): array
{
    return $board->elements()->orderBy('seq')->get()
        ->mapWithKeys(fn (WhiteboardElement $element): array => [$element->element_id => $element->is_private])
        ->all();
}

it('stores a sticky note and its text as private while private writing is on, and nothing else', function () {
    $board = Whiteboard::factory()->privateWriting()->create();
    [$user, $member] = whiteboardMember($board);
    [$note, $text] = stickyWithText('note', 'Secret idea 7391');

    putWhiteboardElements($this->actingAs($user), $board, [
        $note,
        $text,
        sceneElement(['id' => 'box', 'index' => 'a3', 'boundElements' => [['id' => 'label', 'type' => 'text']]]),
        sceneElement(['id' => 'label', 'type' => 'text', 'index' => 'a4', 'text' => 'Visible label', 'containerId' => 'box']),
        sceneElement(['id' => 'free', 'type' => 'text', 'index' => 'a5', 'text' => 'Visible text', 'containerId' => null]),
    ])->assertOk()->assertJsonPath('rejected', []);

    expect(privateFlags($board))->toBe(['note' => true, 'note-text' => true, 'box' => false, 'label' => false, 'free' => false])
        ->and($board->elements()->where('element_id', 'note-text')->sole()->author_member_id)->toBe($member->id)
        ->and($board->elements()->where('element_id', 'note-text')->sole()->data['text'])->toBe('Secret idea 7391');
});

it('hides nothing while private writing is off', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    putWhiteboardElements($this->actingAs($user), $board, stickyWithText('note', 'Plain idea'))->assertOk();

    expect(privateFlags($board))->toBe(['note' => false, 'note-text' => false])
        ->and(elementsChangedPayloads()[0]['elements'][1]['text'])->toBe('Plain idea');
});

it('leaves the notes written before private writing visible, with what is typed into them', function () {
    $board = Whiteboard::factory()->privateWriting()->create(['seq' => 1]);
    [$author, $authorMember] = whiteboardMember($board);
    [$other] = whiteboardMember($board);
    [$note, $text] = stickyWithText('old', 'Written before');
    storeWhiteboardElement($board, $note, 1, $authorMember);

    putWhiteboardElements($this->actingAs($author), $board, [$text, [...$note, 'version' => 2, 'x' => 40]])
        ->assertOk()
        ->assertJsonPath('rejected', []);

    expect(privateFlags($board))->toBe(['old-text' => false, 'old' => false])
        ->and(elementsChangedPayloads()[0]['elements'])->toHaveCount(2);

    $this->actingAs($other)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertOk()
        ->assertJsonPath('elements.0.customData', ['skrum' => ['kind' => 'sticky']])
        ->assertJsonPath('elements.1.text', 'Written before');
});

it('gives the author the real note, in every tab', function () {
    $table = privateWritingBoard();

    $this->actingAs($table['author'])
        ->getJson(route('whiteboards.snapshot.show', $table['board']))
        ->assertOk()
        ->assertJsonPath('elements.0.customData', ['skrum' => ['kind' => 'sticky']])
        ->assertJsonPath('elements.1.text', $table['secret'])
        ->assertJsonPath('elements.1.originalText', $table['secret']);

    $this->actingAs($table['author'])
        ->getJson(route('whiteboards.elements.index', [$table['board'], 'since' => 0]))
        ->assertOk()
        ->assertJsonPath('elements.1.text', $table['secret']);
});

it('masks a private note for everyone but its author', function (string $viewer) {
    $table = privateWritingBoard();
    $request = fn () => whiteboardViewer($this, $table[$viewer]);

    $snapshot = $request()->getJson(route('whiteboards.snapshot.show', $table['board']))
        ->assertOk()
        ->assertJsonPath('elements.0.id', 'note')
        ->assertJsonPath('elements.0.customData', ['skrum' => ['kind' => 'sticky', 'masked' => true]])
        ->assertJsonPath('elements.0.x', 10)
        ->assertJsonPath('elements.0.y', 20)
        ->assertJsonPath('elements.0.width', 100)
        ->assertJsonPath('elements.0.height', 50)
        ->assertJsonPath('elements.0.backgroundColor', '#fff3bf')
        ->assertJsonPath('elements.0.boundElements', [['id' => 'note-text', 'type' => 'text']])
        ->assertJsonPath('elements.1.id', 'note-text')
        ->assertJsonPath('elements.1.text', '')
        ->assertJsonPath('elements.1.originalText', '')
        ->assertJsonPath('elements.1.containerId', 'note')
        ->assertJsonPath('elements.1.isDeleted', false)
        ->assertJsonPath('elements.1.version', 1)
        ->assertJsonPath('elements.1.versionNonce', 100);

    $delta = $request()->getJson(route('whiteboards.elements.index', [$table['board'], 'since' => 0]))
        ->assertOk()
        ->assertJsonPath('elements.0.customData.skrum.masked', true)
        ->assertJsonPath('elements.1.text', '');

    $page = $request()->get(route('whiteboards.show', $table['board']))->assertOk();

    expect(whiteboardPayloadExposes($snapshot->getContent(), $table['secret']))->toBeFalse()
        ->and(whiteboardPayloadExposes($delta->getContent(), $table['secret']))->toBeFalse()
        ->and(whiteboardPayloadExposes($page->getContent(), $table['secret']))->toBeFalse();
})->with([
    'another member' => 'other',
    'the facilitator' => 'facilitator',
    'a guest' => 'guest',
]);

it('masks a private note whose author is gone for everyone', function () {
    $board = Whiteboard::factory()->privateWriting()->create(['seq' => 2]);
    [$user] = whiteboardFacilitator($board);
    [$note, $text] = stickyWithText('orphan', 'Secret idea 7391');
    storeWhiteboardElement($board, $note, 1, null, private: true);
    storeWhiteboardElement($board, $text, 2, null, private: true);

    $snapshot = $this->actingAs($user)->getJson(route('whiteboards.snapshot.show', $board))->assertOk();

    expect(whiteboardPayloadExposes($snapshot->getContent(), 'Secret idea'))->toBeFalse();

    putWhiteboardElements($this->actingAs($user), $board, [[...$text, 'version' => 2, 'text' => 'Mine now']])
        ->assertJsonPath('rejected.0.reason', 'private');
});

it('never broadcasts the elements of a write that touches a private note', function () {
    $board = Whiteboard::factory()->privateWriting()->create();
    [$author] = whiteboardMember($board);
    [$note, $text] = stickyWithText('note', 'Secret idea 7391');
    $longer = 'Secret idea 7391, longer';

    putWhiteboardElements($this->actingAs($author), $board, [$note, $text, sceneElement(['id' => 'box', 'index' => 'a3'])])->assertOk();
    putWhiteboardElements($this->actingAs($author), $board, [[...$text, 'version' => 2, 'text' => $longer, 'originalText' => $longer]])->assertOk();
    putWhiteboardElements($this->actingAs($author), $board, [[...$note, 'version' => 2, 'x' => 300]])->assertOk();
    putWhiteboardElements($this->actingAs($author), $board, [sceneElement(['id' => 'box', 'index' => 'a3', 'version' => 2, 'x' => 77])])->assertOk();

    $payloads = elementsChangedPayloads();

    expect(array_slice($payloads, 0, 3))->toBe([
        ['seq' => 3, 'fromSeq' => 0],
        ['seq' => 4, 'fromSeq' => 3],
        ['seq' => 5, 'fromSeq' => 4],
    ])
        ->and($payloads[3]['elements'][0]['id'])->toBe('box')
        ->and(whiteboardPayloadExposes($payloads, 'Secret idea'))->toBeFalse();
});

it('refuses every change another member makes to a private note and keeps the text', function (string $viewer) {
    $table = privateWritingBoard();
    $board = $table['board'];
    $request = fn () => whiteboardViewer($this, $table[$viewer]);
    [$note, $masked] = stickyWithText('note', '');

    putWhiteboardElements($request(), $board, [$masked, $note])
        ->assertOk()
        ->assertExactJson(['seq' => 2, 'fromSeq' => 2, 'rejected' => []]);

    $edit = putWhiteboardElements($request(), $board, [
        [...$masked, 'version' => 2, 'text' => 'Overwritten', 'originalText' => 'Overwritten'],
        [...$note, 'version' => 2, 'x' => 900],
    ])
        ->assertOk()
        ->assertJsonPath('seq', 2)
        ->assertJsonPath('rejected.0.id', 'note-text')
        ->assertJsonPath('rejected.0.reason', 'private')
        ->assertJsonPath('rejected.0.element.text', '')
        ->assertJsonPath('rejected.0.element.version', 1)
        ->assertJsonPath('rejected.1.id', 'note')
        ->assertJsonPath('rejected.1.reason', 'private')
        ->assertJsonPath('rejected.1.element.x', 10)
        ->assertJsonPath('rejected.1.element.customData.skrum.masked', true);

    $deletion = putWhiteboardElements($request(), $board, [
        [...$masked, 'version' => 2, 'isDeleted' => true],
        [...$note, 'version' => 2, 'isDeleted' => true],
    ])
        ->assertOk()
        ->assertJsonPath('rejected.0.reason', 'private')
        ->assertJsonPath('rejected.1.reason', 'private');

    $stale = putWhiteboardElements($request(), $board, [[...$masked, 'versionNonce' => 500, 'text' => 'Overwritten']])
        ->assertOk()
        ->assertJsonPath('rejected.0.reason', 'stale')
        ->assertJsonPath('rejected.0.element.text', '');

    $storedText = $board->elements()->where('element_id', 'note-text')->sole();
    $storedNote = $board->elements()->where('element_id', 'note')->sole();

    expect($storedText->data['text'])->toBe($table['secret'])
        ->and($storedText->data['containerId'])->toBe('note')
        ->and($storedText->is_deleted)->toBeFalse()
        ->and($storedText->version)->toBe(1)
        ->and($storedNote->data['x'])->toBe(10)
        ->and($storedNote->is_deleted)->toBeFalse()
        ->and($board->fresh()->seq)->toBe(2)
        ->and(whiteboardPayloadExposes($edit->getContent().$deletion->getContent().$stale->getContent(), $table['secret']))->toBeFalse();

    Event::assertNotDispatched(WhiteboardElementsChanged::class);
})->with([
    'another member' => 'other',
    'the facilitator' => 'facilitator',
    'a guest' => 'guest',
]);

it('takes the new index a canvas gives a hidden note of someone else, and nothing else', function () {
    $table = privateWritingBoard();
    $board = $table['board'];
    [$own, $ownText] = stickyWithText('early', 'Typed at the same time');
    storeWhiteboardElement($board, $own, 3, $table['otherMember'], private: true);
    storeWhiteboardElement($board, $ownText, 4, $table['otherMember'], private: true);
    $board->update(['seq' => 4]);
    [$note, $masked] = stickyWithText('note', '');

    $repair = putWhiteboardElements($this->actingAs($table['other']), $board, [
        [...$note, 'customData' => ['skrum' => ['kind' => 'sticky', 'masked' => true]], 'index' => 'a1V', 'version' => 2, 'versionNonce' => 7, 'updated' => 1760263200000],
        [...$masked, 'isDeleted' => true, 'index' => 'a2V', 'version' => 2, 'versionNonce' => 8, 'updated' => 1760263200000],
    ])
        ->assertOk()
        ->assertExactJson(['seq' => 6, 'fromSeq' => 4, 'rejected' => []]);

    $storedNote = $board->elements()->where('element_id', 'note')->sole();
    $storedText = $board->elements()->where('element_id', 'note-text')->sole();

    expect($storedNote->data['index'])->toBe('a1V')
        ->and($storedNote->data['x'])->toBe(10)
        ->and($storedNote->data['customData'])->toBe(['skrum' => ['kind' => 'sticky']])
        ->and($storedNote->version)->toBe(2)
        ->and($storedNote->version_nonce)->toBe(7)
        ->and($storedNote->data['version'])->toBe(2)
        ->and($storedNote->is_private)->toBeTrue()
        ->and($storedNote->author_member_id)->toBe($table['authorMember']->id)
        ->and($storedText->data['index'])->toBe('a2V')
        ->and($storedText->data['text'])->toBe($table['secret'])
        ->and($storedText->data['originalText'])->toBe($table['secret'])
        ->and($storedText->data['isDeleted'])->toBeFalse()
        ->and($storedText->is_deleted)->toBeFalse()
        ->and($storedText->version)->toBe(2)
        ->and($storedText->version_nonce)->toBe(8)
        ->and($storedText->seq)->toBe(6)
        ->and($storedText->is_private)->toBeTrue()
        ->and($storedText->author_member_id)->toBe($table['authorMember']->id)
        ->and(elementsChangedPayloads())->toBe([['seq' => 6, 'fromSeq' => 4]])
        ->and(whiteboardPayloadExposes($repair->getContent(), $table['secret']))->toBeFalse();

    $this->actingAs($table['author'])
        ->getJson(route('whiteboards.elements.index', [$board, 'since' => 4]))
        ->assertOk()
        ->assertJsonPath('elements.0.id', 'note')
        ->assertJsonPath('elements.0.index', 'a1V')
        ->assertJsonPath('elements.1.index', 'a2V')
        ->assertJsonPath('elements.1.version', 2)
        ->assertJsonPath('elements.1.text', $table['secret']);

    $masked = $this->actingAs($table['other'])
        ->getJson(route('whiteboards.elements.index', [$board, 'since' => 4]))
        ->assertOk()
        ->assertJsonPath('elements.1.index', 'a2V')
        ->assertJsonPath('elements.1.versionNonce', 8)
        ->assertJsonPath('elements.1.text', '');

    expect(whiteboardPayloadExposes($masked->getContent(), $table['secret']))->toBeFalse();
});

it('takes nothing but an index from the canvas of another member', function (string $viewer) {
    $table = privateWritingBoard();
    $board = $table['board'];
    $request = fn () => whiteboardViewer($this, $table[$viewer]);
    [$note, $masked] = stickyWithText('note', '');

    putWhiteboardElements($request(), $board, [
        [...$note, 'index' => 'a1V', 'version' => 2, 'x' => 900],
        [...$masked, 'index' => 'a2V', 'version' => 2, 'text' => 'Overwritten', 'originalText' => 'Overwritten'],
    ])
        ->assertOk()
        ->assertJsonPath('seq', 2)
        ->assertJsonPath('rejected.0.id', 'note')
        ->assertJsonPath('rejected.0.reason', 'private')
        ->assertJsonPath('rejected.0.element.index', 'a1')
        ->assertJsonPath('rejected.1.id', 'note-text')
        ->assertJsonPath('rejected.1.reason', 'private')
        ->assertJsonPath('rejected.1.element.index', 'a2');

    putWhiteboardElements($request(), $board, [
        [...$note, 'index' => 'a1V', 'version' => 2, 'isDeleted' => true],
        [...$masked, 'index' => 'a2V', 'version' => 2, 'containerId' => null],
        [...$masked, 'index' => 'a2V', 'version' => 3],
        [...$note, 'index' => 'a1V', 'version' => 2147483647],
    ])
        ->assertOk()
        ->assertJsonPath('seq', 2)
        ->assertJsonCount(4, 'rejected')
        ->assertJsonPath('rejected.0.reason', 'private')
        ->assertJsonPath('rejected.1.reason', 'private')
        ->assertJsonPath('rejected.2.reason', 'private')
        ->assertJsonPath('rejected.3.reason', 'private');

    expect($board->elements()->orderBy('seq')->pluck('version')->all())->toBe([1, 1])
        ->and($board->elements()->where('element_id', 'note')->sole()->data['index'])->toBe('a1')
        ->and($board->elements()->where('element_id', 'note-text')->sole()->data['index'])->toBe('a2');

    Event::assertNotDispatched(WhiteboardElementsChanged::class);

    putWhiteboardElements($request(), $board, [[...$masked, 'versionNonce' => 50]])
        ->assertOk()
        ->assertExactJson(['seq' => 3, 'fromSeq' => 2, 'rejected' => []]);

    $storedText = $board->elements()->where('element_id', 'note-text')->sole();

    expect($storedText->version)->toBe(1)
        ->and($storedText->version_nonce)->toBe(50)
        ->and($storedText->data['text'])->toBe($table['secret'])
        ->and($storedText->is_private)->toBeTrue()
        ->and(elementsChangedPayloads())->toBe([['seq' => 3, 'fromSeq' => 2]]);
})->with([
    'another member' => 'other',
    'the facilitator' => 'facilitator',
    'a guest' => 'guest',
]);

it('refuses to bind a text to a private note of someone else, or to detach its text', function () {
    $table = privateWritingBoard();
    $board = $table['board'];
    storeWhiteboardElement($board, sceneElement(['id' => 'mine', 'type' => 'text', 'text' => 'Mine', 'containerId' => null, 'index' => 'a5']), 3, $table['otherMember']);
    $board->update(['seq' => 3]);

    putWhiteboardElements($this->actingAs($table['other']), $board, [
        sceneElement(['id' => 'intruder', 'type' => 'text', 'text' => 'Typed over', 'containerId' => 'note', 'index' => 'a6']),
        sceneElement(['id' => 'mine', 'type' => 'text', 'text' => 'Mine', 'containerId' => 'note', 'index' => 'a5', 'version' => 2]),
        sceneElement(['id' => 'note-text', 'type' => 'text', 'text' => '', 'originalText' => '', 'containerId' => null, 'index' => 'a2', 'version' => 2]),
    ])
        ->assertOk()
        ->assertJsonPath('seq', 3)
        ->assertJsonPath('rejected.0', ['id' => 'intruder', 'reason' => 'private', 'element' => null])
        ->assertJsonPath('rejected.1.id', 'mine')
        ->assertJsonPath('rejected.1.reason', 'private')
        ->assertJsonPath('rejected.1.element.containerId', null)
        ->assertJsonPath('rejected.2.id', 'note-text')
        ->assertJsonPath('rejected.2.reason', 'private')
        ->assertJsonPath('rejected.2.element.containerId', 'note');

    $stored = $board->elements()->where('element_id', 'note-text')->sole();

    expect($board->elements()->where('element_id', 'intruder')->exists())->toBeFalse()
        ->and($stored->data['containerId'])->toBe('note')
        ->and($stored->data['text'])->toBe($table['secret']);
});

it('lets a private note take only the texts of its own author', function () {
    $table = privateWritingBoard();
    $board = $table['board'];
    storeWhiteboardElement($board, sceneElement(['id' => 'theirs', 'type' => 'text', 'text' => 'Theirs', 'containerId' => null, 'index' => 'a5']), 3, $table['otherMember']);
    storeWhiteboardElement($board, sceneElement(['id' => 'own', 'type' => 'text', 'text' => 'Own', 'containerId' => null, 'index' => 'a6']), 4, $table['authorMember']);
    $board->update(['seq' => 4]);

    putWhiteboardElements($this->actingAs($table['author']), $board, [
        sceneElement(['id' => 'theirs', 'type' => 'text', 'text' => 'Theirs', 'containerId' => 'note', 'index' => 'a5', 'version' => 2]),
        sceneElement(['id' => 'own', 'type' => 'text', 'text' => 'Own, now hidden', 'containerId' => 'note', 'index' => 'a6', 'version' => 2]),
        sceneElement(['id' => 'second', 'type' => 'text', 'text' => 'Typed later', 'containerId' => 'note', 'index' => 'a7']),
    ])
        ->assertOk()
        ->assertJsonCount(1, 'rejected')
        ->assertJsonPath('rejected.0.id', 'theirs')
        ->assertJsonPath('rejected.0.reason', 'private')
        ->assertJsonPath('rejected.0.element.text', 'Theirs');

    expect(privateFlags($board))->toBe(['note' => true, 'note-text' => true, 'theirs' => false, 'own' => true, 'second' => true])
        ->and(elementsChangedPayloads())->toBe([['seq' => 6, 'fromSeq' => 4]]);
});

it('lets the author change, delete and bring back their note, which stays private', function () {
    $table = privateWritingBoard();
    $board = $table['board'];
    [, $text] = stickyWithText('note', $table['secret']);
    $longer = "{$table['secret']} and more";
    $author = fn () => $this->actingAs($table['author']);

    putWhiteboardElements($author(), $board, [[...$text, 'version' => 2, 'text' => $longer, 'originalText' => $longer]])->assertJsonPath('rejected', []);
    putWhiteboardElements($author(), $board, [[...$text, 'version' => 3, 'isDeleted' => true]])->assertJsonPath('rejected', []);

    $tombstone = $this->actingAs($table['other'])
        ->getJson(route('whiteboards.elements.index', [$board, 'since' => 2]))
        ->assertOk()
        ->assertJsonPath('elements.0.id', 'note-text')
        ->assertJsonPath('elements.0.isDeleted', true)
        ->assertJsonPath('elements.0.text', '');

    putWhiteboardElements($author(), $board, [[...$text, 'version' => 4]])->assertJsonPath('rejected', []);

    $stored = $board->elements()->where('element_id', 'note-text')->sole();

    expect($stored->is_private)->toBeTrue()
        ->and($stored->is_deleted)->toBeFalse()
        ->and($stored->version)->toBe(4)
        ->and($stored->data['text'])->toBe($table['secret'])
        ->and(whiteboardPayloadExposes($tombstone->getContent(), $table['secret']))->toBeFalse()
        ->and(elementsChangedPayloads())->toBe([
            ['seq' => 3, 'fromSeq' => 2],
            ['seq' => 4, 'fromSeq' => 3],
            ['seq' => 5, 'fromSeq' => 4],
        ]);
});

it('treats a bound text whose container is unknown as private while private writing is on', function () {
    $board = Whiteboard::factory()->privateWriting()->create();
    [$author] = whiteboardMember($board);
    [$other] = whiteboardMember($board);

    putWhiteboardElements($this->actingAs($author), $board, [
        sceneElement(['id' => 'early', 'type' => 'text', 'text' => 'Secret idea 7391', 'originalText' => 'Secret idea 7391', 'containerId' => 'not-written-yet']),
    ])->assertOk()->assertJsonPath('rejected', []);

    $snapshot = $this->actingAs($other)->getJson(route('whiteboards.snapshot.show', $board))->assertOk();

    expect(privateFlags($board))->toBe(['early' => true])
        ->and(elementsChangedPayloads())->toBe([['seq' => 1, 'fromSeq' => 0]])
        ->and(whiteboardPayloadExposes($snapshot->getContent(), 'Secret idea'))->toBeFalse();
});

it('keeps the text of a note out of the log, even when the database refuses the write', function () {
    $table = privateWritingBoard();
    [, $text] = stickyWithText('note', $table['secret']);
    $again = "{$table['secret']} again";
    $lines = [];

    Event::listen(MessageLogged::class, function (MessageLogged $logged) use (&$lines): void {
        $lines[] = $logged->message;
        $exception = $logged->context['exception'] ?? null;

        while ($exception instanceof Throwable) {
            $lines[] = $exception->getMessage();
            $exception = $exception->getPrevious();
        }
    });

    DB::statement('alter table whiteboard_elements add constraint whiteboard_elements_refused check (version < 2)');

    $failed = putWhiteboardElements($this->actingAs($table['author']), $table['board'], [
        [...$text, 'version' => 2, 'text' => $again, 'originalText' => $again],
    ])->assertStatus(500);

    putWhiteboardElements($this->actingAs($table['other']), $table['board'], [[...$text, 'version' => 2, 'text' => 'Overwritten']])
        ->assertOk()
        ->assertJsonPath('rejected.0.reason', 'private');

    expect($lines)->not->toBeEmpty()
        ->and(whiteboardPayloadExposes($lines, $table['secret']))->toBeFalse()
        ->and(whiteboardPayloadExposes($failed->getContent(), $table['secret']))->toBeFalse()
        ->and($table['board']->elements()->where('element_id', 'note-text')->sole()->data['text'])->toBe($table['secret']);
});
