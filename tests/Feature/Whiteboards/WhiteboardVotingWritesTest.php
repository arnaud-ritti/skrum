<?php

use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Events\Whiteboards\WhiteboardVoteChanged;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardTemplate;
use App\Models\WhiteboardVote;
use App\Models\WhiteboardVoteSession;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake();
    Event::fake([WhiteboardElementsChanged::class, WhiteboardVoteChanged::class]);
});

/**
 * A board whose note "note" (words "Ship it") and note "kept" are under an
 * open vote. The member has put two votes on "note" and one on "kept" (the
 * whole budget); someone else has put one on "kept".
 *
 * @return array{0: Whiteboard, 1: User, 2: WhiteboardVoteSession, 3: array<string, mixed>, 4: array<string, mixed>}
 */
function boardUnderVote(): array
{
    $board = Whiteboard::factory()->create(['seq' => 1]);
    whiteboardFacilitator($board);
    [$user, $member] = whiteboardMember($board);
    [, $other] = whiteboardMember($board);
    [$note, $words] = whiteboardSticky($board, 'note', 'Ship it');
    whiteboardSticky($board, 'kept', 'Keep it');
    $session = openWhiteboardVote($board, ['allow_multiple' => true]);

    castWhiteboardVote($session, $member, 'note', 2);
    castWhiteboardVote($session, $member, 'kept', 1);
    castWhiteboardVote($session, $other, 'kept', 1);

    return [$board, $user, $session, $note->data, $words->data];
}

function writeDuringVote(mixed $test, Whiteboard $board, array $elements): mixed
{
    return $test->putJson(route('whiteboards.elements.update', $board), ['elements' => $elements]);
}

it('rejects a change of the words of a note under vote and hands back the stored text', function (array $change) {
    [$board, $user, , , $words] = boardUnderVote();

    writeDuringVote($this->actingAs($user), $board, [[...$words, 'version' => 2, ...$change]])
        ->assertOk()
        ->assertJsonPath('seq', 1)
        ->assertJsonPath('fromSeq', 1)
        ->assertJsonPath('rejected.0.id', 'note-text')
        ->assertJsonPath('rejected.0.reason', 'voting')
        ->assertJsonPath('rejected.0.element', $words);

    $stored = $board->elements()->where('element_id', 'note-text')->sole();

    expect($stored->data)->toEqual($words)
        ->and($stored->is_deleted)->toBeFalse()
        ->and(WhiteboardVote::query()->count())->toBe(3);

    Event::assertNotDispatched(WhiteboardElementsChanged::class);
    Event::assertNotDispatched(WhiteboardVoteChanged::class);
})->with([
    'new words' => [['text' => 'Ship it later', 'originalText' => 'Ship it later']],
    'new words behind the same original' => [['text' => 'Sink it']],
    'a new original behind the same words' => [['originalText' => 'Sink it']],
    'the text erased on its own' => [['isDeleted' => true]],
    'the text taken off the note' => [['containerId' => null]],
]);

it('rejects a text of a note under vote rewritten as another type', function () {
    [$board, $user, , , $words] = boardUnderVote();

    writeDuringVote($this->actingAs($user), $board, [sceneElement(['id' => 'note-text', 'type' => 'rectangle', 'version' => 2])])
        ->assertOk()
        ->assertJsonPath('seq', 1)
        ->assertJsonPath('fromSeq', 1)
        ->assertJsonCount(1, 'rejected')
        ->assertJsonPath('rejected.0.id', 'note-text')
        ->assertJsonPath('rejected.0.reason', 'voting')
        ->assertJsonPath('rejected.0.element', $words);

    $stored = $board->elements()->where('element_id', 'note-text')->sole();

    expect($stored->type)->toBe('text')
        ->and($stored->data)->toEqual($words)
        ->and($stored->version)->toBe(1)
        ->and(WhiteboardVote::query()->count())->toBe(3);

    Event::assertNotDispatched(WhiteboardElementsChanged::class);
    Event::assertNotDispatched(WhiteboardVoteChanged::class);
});

it('rejects a new text and a re-bound text on a note under vote', function () {
    [$board, $user] = boardUnderVote();
    $loose = sceneElement(['id' => 'loose', 'type' => 'text', 'text' => 'Loose', 'originalText' => 'Loose']);
    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id, 'element_id' => 'loose', 'type' => 'text', 'version_nonce' => 100, 'data' => $loose,
    ]);

    writeDuringVote($this->actingAs($user), $board, [
        sceneElement(['id' => 'extra', 'type' => 'text', 'text' => 'Also', 'originalText' => 'Also', 'containerId' => 'note']),
        [...$loose, 'version' => 2, 'containerId' => 'note'],
    ])
        ->assertOk()
        ->assertJsonPath('seq', 1)
        ->assertJsonCount(2, 'rejected')
        ->assertJsonPath('rejected.0', ['id' => 'extra', 'reason' => 'voting', 'element' => null])
        ->assertJsonPath('rejected.1.id', 'loose')
        ->assertJsonPath('rejected.1.reason', 'voting')
        ->assertJsonPath('rejected.1.element', $loose);

    expect($board->elements()->where('element_id', 'extra')->exists())->toBeFalse();
});

it('refuses both halves when the words of a note under vote are cleared', function (array $order) {
    [$board, $user, , $note, $words] = boardUnderVote();
    $batch = [
        'note' => [...$note, 'version' => 2, 'boundElements' => []],
        'text' => [...$words, 'version' => 2, 'isDeleted' => true],
    ];

    writeDuringVote($this->actingAs($user), $board, array_map(fn (string $key): array => $batch[$key], $order))
        ->assertOk()
        ->assertJsonPath('seq', 1)
        ->assertJsonPath('fromSeq', 1)
        ->assertJsonCount(2, 'rejected')
        ->assertJsonPath('rejected.0.id', 'note')
        ->assertJsonPath('rejected.0.reason', 'voting')
        ->assertJsonPath('rejected.0.element', $note)
        ->assertJsonPath('rejected.1.id', 'note-text')
        ->assertJsonPath('rejected.1.reason', 'voting')
        ->assertJsonPath('rejected.1.element', $words);

    $storedNote = $board->elements()->where('element_id', 'note')->sole();
    $storedWords = $board->elements()->where('element_id', 'note-text')->sole();

    expect($storedNote->data)->toEqual($note)
        ->and($storedNote->data['boundElements'])->toBe([['id' => 'note-text', 'type' => 'text']])
        ->and($storedNote->version)->toBe(1)
        ->and($storedWords->data)->toEqual($words)
        ->and($storedWords->is_deleted)->toBeFalse()
        ->and(WhiteboardVote::query()->count())->toBe(3);

    Event::assertNotDispatched(WhiteboardElementsChanged::class);
    Event::assertNotDispatched(WhiteboardVoteChanged::class);
})->with([
    'the note first' => [['note', 'text']],
    'the text first' => [['text', 'note']],
]);

it('refuses both halves of the first words typed into an empty note under vote', function (array $order) {
    [$board, $user] = boardUnderVote();
    $empty = sceneElement(['id' => 'empty', 'backgroundColor' => '#fff3bf', 'customData' => ['skrum' => ['kind' => 'sticky']]]);
    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id, 'element_id' => 'empty', 'type' => 'rectangle', 'version' => 1, 'version_nonce' => 100,
        'is_sticky' => true, 'seq' => 1, 'data' => $empty,
    ]);
    WhiteboardVoteSession::query()->sole()->update(['element_ids' => ['note', 'kept', 'empty']]);
    $batch = [
        'note' => [...$empty, 'version' => 2, 'boundElements' => [['id' => 'first', 'type' => 'text']]],
        'text' => sceneElement(['id' => 'first', 'type' => 'text', 'text' => 'Hello', 'originalText' => 'Hello', 'containerId' => 'empty']),
    ];

    writeDuringVote($this->actingAs($user), $board, array_map(fn (string $key): array => $batch[$key], $order))
        ->assertOk()
        ->assertJsonPath('seq', 1)
        ->assertJsonCount(2, 'rejected')
        ->assertJsonPath('rejected.0.id', 'empty')
        ->assertJsonPath('rejected.0.reason', 'voting')
        ->assertJsonPath('rejected.0.element', $empty)
        ->assertJsonPath('rejected.1', ['id' => 'first', 'reason' => 'voting', 'element' => null]);

    $storedNote = $board->elements()->where('element_id', 'empty')->sole();

    expect($storedNote->data)->toEqual($empty)
        ->and($storedNote->data['boundElements'])->toBeNull()
        ->and($storedNote->version)->toBe(1)
        ->and($board->elements()->where('element_id', 'first')->exists())->toBeFalse();

    Event::assertNotDispatched(WhiteboardElementsChanged::class);
})->with([
    'the note first' => [['note', 'text']],
    'the text first' => [['text', 'note']],
]);

it('still lets an arrow be attached to a note under vote', function () {
    [$board, $user, , $note] = boardUnderVote();
    $empty = sceneElement(['id' => 'empty', 'customData' => ['skrum' => ['kind' => 'sticky']]]);
    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id, 'element_id' => 'empty', 'type' => 'rectangle', 'version' => 1, 'version_nonce' => 100,
        'is_sticky' => true, 'seq' => 1, 'data' => $empty,
    ]);
    WhiteboardVoteSession::query()->sole()->update(['element_ids' => ['note', 'kept', 'empty']]);

    writeDuringVote($this->actingAs($user), $board, [
        [...$note, 'version' => 2, 'boundElements' => [['id' => 'link', 'type' => 'arrow'], ['id' => 'note-text', 'type' => 'text']]],
        [...$empty, 'version' => 2, 'x' => 300, 'boundElements' => []],
    ])
        ->assertOk()
        ->assertJsonPath('rejected', [])
        ->assertJsonPath('seq', 3);

    expect($board->elements()->where('element_id', 'note')->sole()->data['boundElements'])->toHaveCount(2)
        ->and($board->elements()->where('element_id', 'empty')->sole()->data['x'])->toBe(300);
});

it('still lets a note under vote be moved, restyled and resized', function () {
    [$board, $user, , $note, $words] = boardUnderVote();

    writeDuringVote($this->actingAs($user), $board, [
        [...$words, 'version' => 2, 'x' => 405, 'width' => 60, 'text' => "Ship\nit", 'fontSize' => 16],
        [...$note, 'version' => 2, 'x' => 400, 'width' => 70, 'backgroundColor' => '#ffc9c9'],
    ])
        ->assertOk()
        ->assertJsonPath('rejected', [])
        ->assertJsonPath('seq', 3);

    $text = $board->elements()->where('element_id', 'note-text')->sole()->data;

    expect($text['text'])->toBe("Ship\nit")
        ->and($text['originalText'])->toBe('Ship it')
        ->and($board->elements()->where('element_id', 'note')->sole()->data['backgroundColor'])->toBe('#ffc9c9')
        ->and(WhiteboardVote::query()->count())->toBe(3);

    Event::assertNotDispatched(WhiteboardVoteChanged::class);
});

it('accepts the first move of a text stored without its original', function () {
    [$board, $user, , , $words] = boardUnderVote();
    $legacy = Arr::except($words, 'originalText');
    $board->elements()->where('element_id', 'note-text')->sole()->update(['data' => $legacy]);

    writeDuringVote($this->actingAs($user), $board, [[...$legacy, 'version' => 2, 'x' => 77, 'originalText' => 'Ship it']])
        ->assertOk()
        ->assertJsonPath('rejected', []);

    expect($board->elements()->where('element_id', 'note-text')->sole()->data['x'])->toBe(77);
});

it('freezes the words for the facilitator too', function () {
    [$board, , , , $words] = boardUnderVote();
    $facilitator = $board->facilitator->user;

    writeDuringVote($this->actingAs($facilitator), $board, [[...$words, 'version' => 2, 'text' => 'Mine', 'originalText' => 'Mine']])
        ->assertOk()
        ->assertJsonPath('rejected.0.reason', 'voting');
});

it('leaves a note added after the vote opened free to edit', function () {
    [$board, $user] = boardUnderVote();
    [, $late] = whiteboardSticky($board, 'late', 'Draft');

    writeDuringVote($this->actingAs($user), $board, [[...$late->data, 'version' => 2, 'text' => 'Final', 'originalText' => 'Final']])
        ->assertOk()
        ->assertJsonPath('rejected', []);

    expect($board->elements()->where('element_id', 'late-text')->sole()->data['text'])->toBe('Final');
});

it('frees the words again once the vote is closed', function () {
    [$board, $user, $session, , $words] = boardUnderVote();
    $session->update(['closed_at' => now(), 'results' => []]);

    writeDuringVote($this->actingAs($user), $board, [[...$words, 'version' => 2, 'text' => 'Later', 'originalText' => 'Later']])
        ->assertOk()
        ->assertJsonPath('rejected', []);
});

it('deletes a note under vote with its text, whatever their order, and refunds its votes', function (array $order) {
    [$board, $user, $session, $note, $words] = boardUnderVote();
    $batch = [
        'note' => [...$note, 'version' => 2, 'isDeleted' => true],
        'text' => [...$words, 'version' => 2, 'isDeleted' => true],
    ];

    writeDuringVote($this->actingAs($user), $board, array_map(fn (string $key): array => $batch[$key], $order))
        ->assertOk()
        ->assertJsonPath('rejected', [])
        ->assertJsonPath('seq', 3);

    expect($board->elements()->whereIn('element_id', ['note', 'note-text'])->where('is_deleted', true)->count())->toBe(2)
        ->and($session->votes()->where('element_id', 'note')->count())->toBe(0)
        ->and((int) $session->votes()->where('element_id', 'kept')->sum('count'))->toBe(2);

    Event::assertDispatchedTimes(WhiteboardVoteChanged::class, 1);
    Event::assertDispatched(WhiteboardVoteChanged::class, fn (WhiteboardVoteChanged $event) => $event->boardId === $board->id
        && $event->broadcastWith() === ['sessionId' => $session->id, 'finishedCount' => 0]);

    $this->actingAs($user)
        ->getJson(route('whiteboards.voteSessions.show', [$board, $session]))
        ->assertJsonPath('myVotes', [['elementId' => 'kept', 'count' => 1]])
        ->assertJsonPath('remaining', 2);
})->with([
    'the note first' => [['note', 'text']],
    'the text first' => [['text', 'note']],
]);

it('refunds once when the delete is sent twice', function () {
    [$board, $user, , $note, $words] = boardUnderVote();
    $batch = [[...$note, 'version' => 2, 'isDeleted' => true], [...$words, 'version' => 2, 'isDeleted' => true]];

    writeDuringVote($this->actingAs($user), $board, $batch)->assertOk()->assertJsonPath('seq', 3);
    writeDuringVote($this->actingAs($user), $board, $batch)
        ->assertOk()
        ->assertExactJson(['seq' => 3, 'fromSeq' => 3, 'rejected' => []]);

    Event::assertDispatchedTimes(WhiteboardVoteChanged::class, 1);
    Event::assertDispatchedTimes(WhiteboardElementsChanged::class, 1);
});

it('brings a deleted note back with its words and without its votes', function (array $order) {
    [$board, $user, $session, $note, $words] = boardUnderVote();

    writeDuringVote($this->actingAs($user), $board, [
        [...$note, 'version' => 2, 'isDeleted' => true],
        [...$words, 'version' => 2, 'isDeleted' => true],
    ])->assertJsonPath('rejected', []);

    $batch = ['note' => [...$note, 'version' => 3], 'text' => [...$words, 'version' => 3]];

    writeDuringVote($this->actingAs($user), $board, array_map(fn (string $key): array => $batch[$key], $order))
        ->assertOk()
        ->assertJsonPath('rejected', []);

    expect($board->elements()->whereIn('element_id', ['note', 'note-text'])->where('is_deleted', false)->count())->toBe(2)
        ->and($board->elements()->where('element_id', 'note-text')->sole()->data['text'])->toBe('Ship it')
        ->and($session->votes()->where('element_id', 'note')->count())->toBe(0);

    $this->actingAs($user)
        ->putJson(route('whiteboards.voteSessions.votes.update', [$board, $session, 'note']), ['count' => 1])
        ->assertOk()
        ->assertJsonPath('remaining', 1);
})->with([
    'the note first' => [['note', 'text']],
    'the text first' => [['text', 'note']],
]);

it('says nothing about votes when the deleted note had none or was not under vote', function () {
    [$board, $user] = boardUnderVote();
    [$late] = whiteboardSticky($board, 'late');
    [$unvoted] = whiteboardSticky($board, 'unvoted');
    WhiteboardVoteSession::query()->sole()->update(['element_ids' => ['note', 'kept', 'unvoted']]);

    writeDuringVote($this->actingAs($user), $board, [
        [...$late->data, 'version' => 2, 'isDeleted' => true],
        [...$unvoted->data, 'version' => 2, 'isDeleted' => true],
    ])->assertOk()->assertJsonPath('rejected', []);

    expect(WhiteboardVote::query()->count())->toBe(3);

    Event::assertNotDispatched(WhiteboardVoteChanged::class);
});

it('copies no vote into a duplicate or a template', function () {
    [$board, $user, $session] = boardUnderVote();

    $this->actingAs($user)->postJson(route('whiteboards.duplicate.store', $board))->assertCreated();
    $this->actingAs($user)->postJson(route('whiteboards.template.store', $board), ['name' => 'Voted'])->assertCreated();

    $copy = Whiteboard::query()->whereKeyNot($board->id)->sole();
    $template = WhiteboardTemplate::query()->sole();

    expect($copy->voteSessions()->count())->toBe(0)
        ->and(WhiteboardVoteSession::query()->count())->toBe(1)
        ->and(WhiteboardVote::query()->count())->toBe(3)
        ->and($session->fresh()->isOpen())->toBeTrue()
        ->and($copy->elements()->where('is_sticky', true)->count())->toBe(2)
        ->and(json_encode($template->scene))->not->toContain($session->id)
        ->and(json_encode($template->scene))->not->toContain('vote');

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $copy))
        ->assertJsonPath('voting', null)
        ->assertJsonPath('votingHistory', []);

    $copiedWords = $copy->elements()->where('type', 'text')->get()->first(fn (WhiteboardElement $text) => $text->data['text'] === 'Ship it')->data;

    writeDuringVote($this->actingAs($user), $copy, [[...$copiedWords, 'version' => 2, 'text' => 'Free', 'originalText' => 'Free']])
        ->assertOk()
        ->assertJsonPath('rejected', []);
});

it('accepts a second write of an element whose id is 0', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    writeDuringVote($this->actingAs($user), $board, [sceneElement(['id' => '0'])])->assertOk()->assertJsonPath('rejected', []);
    writeDuringVote($this->actingAs($user), $board, [sceneElement(['id' => '0', 'version' => 2, 'x' => 5])])
        ->assertOk()
        ->assertJsonPath('rejected', []);

    expect($board->elements()->sole()->data['x'])->toBe(5);
});
