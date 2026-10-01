<?php

use App\Actions\Whiteboards\PurgeWhiteboardTombstones;
use App\Events\Whiteboards\WhiteboardChanged;
use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardTemplate;
use App\Models\WhiteboardVersion;
use App\Models\WhiteboardVoteSession;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Storage::fake();
    Event::fake([WhiteboardElementsChanged::class, WhiteboardChanged::class]);
});

function setPrivateWriting(mixed $test, Whiteboard $board, mixed $on): TestResponse
{
    return $test->patchJson(route('whiteboards.settings.update', $board), ['private_writing' => $on]);
}

it('lets the facilitator hide the notes to come and leaves the ones already there alone', function () {
    $board = Whiteboard::factory()->create(['seq' => 2]);
    [$facilitator, $member] = whiteboardFacilitator($board);
    [$note, $text] = stickyWithText('old', 'Written before');
    storeWhiteboardElement($board, $note, 1, $member);
    storeWhiteboardElement($board, $text, 2, $member);

    setPrivateWriting($this->actingAs($facilitator), $board, true)->assertNoContent();

    expect($board->fresh()->private_writing)->toBeTrue()
        ->and($board->fresh()->seq)->toBe(2)
        ->and($board->elements()->where('is_private', true)->count())->toBe(0);

    Event::assertDispatched(WhiteboardChanged::class);
    Event::assertNotDispatched(WhiteboardElementsChanged::class);

    $this->actingAs($facilitator)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('board.privateWriting', true)
        ->assertJsonPath('elements.1.text', 'Written before');
});

it('reveals every live private note and makes every client fetch it', function () {
    $table = privateWritingBoard();
    $board = $table['board'];

    setPrivateWriting($this->actingAs($table['facilitator']), $board, false)->assertNoContent();

    $board->refresh();

    expect($board->private_writing)->toBeFalse()
        ->and($board->seq)->toBe(3)
        ->and($board->elements()->where('is_private', true)->count())->toBe(0)
        ->and($board->elements()->pluck('seq')->unique()->values()->all())->toBe([3])
        ->and($board->elements()->where('element_id', 'note-text')->sole()->version)->toBe(1);

    Event::assertDispatched(WhiteboardChanged::class);
    Event::assertDispatched(
        WhiteboardElementsChanged::class,
        fn (WhiteboardElementsChanged $event) => $event->broadcastWith() === ['seq' => 3, 'fromSeq' => 2],
    );

    whiteboardViewer($this, $table['guest'])
        ->getJson(route('whiteboards.elements.index', [$board, 'since' => 2]))
        ->assertOk()
        ->assertJsonPath('seq', 3)
        ->assertJsonPath('elements.0.customData', ['skrum' => ['kind' => 'sticky']])
        ->assertJsonPath('elements.1.text', $table['secret'])
        ->assertJsonPath('elements.1.version', 1)
        ->assertJsonPath('elements.1.versionNonce', 100);

    $this->actingAs($table['other'])
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('board.privateWriting', false)
        ->assertJsonPath('elements.1.text', $table['secret']);
});

it('never shows a private note that was deleted before the reveal', function () {
    $table = privateWritingBoard();
    $board = $table['board'];
    [, $text] = stickyWithText('note', $table['secret']);

    putWhiteboardElements($this->actingAs($table['author']), $board, [[...$text, 'version' => 2, 'isDeleted' => true]])
        ->assertJsonPath('rejected', []);

    setPrivateWriting($this->actingAs($table['facilitator']), $board, false)->assertNoContent();

    $tombstone = $board->elements()->where('element_id', 'note-text')->sole();
    $delta = $this->actingAs($table['other'])->getJson(route('whiteboards.elements.index', [$board, 'since' => 0]))->assertOk();
    $snapshot = $this->actingAs($table['other'])->getJson(route('whiteboards.snapshot.show', $board))->assertOk();

    expect($tombstone->is_private)->toBeTrue()
        ->and($tombstone->seq)->toBe(3)
        ->and($board->elements()->where('element_id', 'note')->sole()->seq)->toBe(4)
        ->and(whiteboardPayloadExposes($delta->getContent(), $table['secret']))->toBeFalse()
        ->and(whiteboardPayloadExposes($snapshot->getContent(), $table['secret']))->toBeFalse();

    putWhiteboardElements($this->actingAs($table['other']), $board, [[...$text, 'text' => '', 'originalText' => '', 'version' => 3]])
        ->assertJsonPath('rejected.0.reason', 'private');

    putWhiteboardElements($this->actingAs($table['author']), $board, [[...$text, 'version' => 3, 'isDeleted' => true, 'index' => 'a2V']])
        ->assertJsonPath('rejected', []);

    $rewritten = $this->actingAs($table['other'])->getJson(route('whiteboards.elements.index', [$board, 'since' => 4]))->assertOk();

    expect($tombstone->fresh()->is_private)->toBeTrue()
        ->and($tombstone->fresh()->version)->toBe(3)
        ->and(whiteboardPayloadExposes($rewritten->getContent(), $table['secret']))->toBeFalse();

    putWhiteboardElements($this->actingAs($table['author']), $board, [[...$text, 'version' => 4]])
        ->assertJsonPath('rejected', []);

    expect($tombstone->fresh()->is_private)->toBeFalse()
        ->and($tombstone->fresh()->is_deleted)->toBeFalse();

    $this->actingAs($table['other'])
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('elements.1.text', $table['secret']);
});

it('lets a version stored while the notes were hidden show what the reveal showed, and nothing else', function () {
    $table = privateWritingBoard();
    $board = $table['board'];
    $version = WhiteboardVersion::factory()->create([
        'whiteboard_id' => $board->id,
        'private_element_ids' => ['dropped', 'dropped-text', 'note', 'note-text'],
    ]);
    $untouched = WhiteboardVersion::factory()->named()->create(['whiteboard_id' => $board->id]);
    $elsewhere = WhiteboardVersion::factory()->create(['private_element_ids' => ['note', 'note-text']]);

    setPrivateWriting($this->actingAs($table['facilitator']), $board, false)->assertNoContent();

    expect($version->fresh()->private_element_ids)->toBe(['dropped', 'dropped-text'])
        ->and($untouched->fresh()->private_element_ids)->toBe([])
        ->and($elsewhere->fresh()->private_element_ids)->toBe(['note', 'note-text']);
});

it('keeps a note deleted while hidden out of a version when its id is used again', function () {
    $this->travelTo('2026-10-12 10:00:00');

    $table = privateWritingBoard();
    $board = $table['board'];
    [$note, $text] = stickyWithText('note', $table['secret']);

    $this->travel(5)->minutes();

    $version = WhiteboardVersion::factory()->named()->create([
        'whiteboard_id' => $board->id,
        'scene' => ['elements' => [$note, $text], 'fileIds' => []],
        'private_element_ids' => ['note', 'note-text'],
    ]);

    $this->travel(5)->minutes();

    putWhiteboardElements($this->actingAs($table['author']), $board, [
        [...$text, 'version' => 2, 'isDeleted' => true],
        [...$note, 'version' => 2, 'isDeleted' => true],
    ])->assertJsonPath('rejected', []);

    $this->travel(2)->days();

    expect(app(PurgeWhiteboardTombstones::class)->handle())->toBe(2)
        ->and($board->elements()->count())->toBe(0);

    putWhiteboardElements($this->actingAs($table['other']), $board, stickyWithText('note', 'Planted'))
        ->assertJsonPath('rejected', []);

    setPrivateWriting($this->actingAs($table['facilitator']), $board, false)->assertNoContent();

    $planted = $board->elements()->where('element_id', 'note-text')->sole();

    expect($planted->is_private)->toBeFalse()
        ->and($planted->author_member_id)->toBe($table['otherMember']->id)
        ->and($planted->data['text'])->toBe('Planted')
        ->and($version->fresh()->private_element_ids)->toBe(['note', 'note-text']);
});

it('keeps a note deleted while hidden out of an older version when its author brings it back hidden', function () {
    $this->travelTo('2026-10-12 10:00:00');

    $table = privateWritingBoard();
    $board = $table['board'];
    [$note, $text] = stickyWithText('note', $table['secret']);

    $this->travel(5)->minutes();

    $storedBeforeTheDeletion = WhiteboardVersion::factory()->named()->create([
        'whiteboard_id' => $board->id,
        'scene' => ['elements' => [$note, $text], 'fileIds' => []],
        'private_element_ids' => ['note', 'note-text'],
    ]);

    $this->travel(5)->minutes();

    putWhiteboardElements($this->actingAs($table['author']), $board, [
        [...$text, 'version' => 2, 'isDeleted' => true],
        [...$note, 'version' => 2, 'isDeleted' => true],
    ])->assertJsonPath('rejected', []);

    $this->travel(1)->minutes();

    setPrivateWriting($this->actingAs($table['facilitator']), $board, false)->assertNoContent();

    expect($storedBeforeTheDeletion->fresh()->private_element_ids)->toBe(['note', 'note-text'])
        ->and($board->elements()->where('element_id', 'note')->sole()->updated_at->toDateTimeString())->toBe('2026-10-12 10:10:00');

    $this->travel(1)->minutes();

    setPrivateWriting($this->actingAs($table['facilitator']), $board, true)->assertNoContent();

    putWhiteboardElements($this->actingAs($table['author']), $board, [
        [...$note, 'version' => 3],
        [...$text, 'version' => 3],
    ])->assertJsonPath('rejected', []);

    expect($board->elements()->where('is_private', true)->where('is_deleted', false)->count())->toBe(2);

    $this->travel(1)->minutes();

    $storedAfterTheReturn = WhiteboardVersion::factory()->create([
        'whiteboard_id' => $board->id,
        'scene' => ['elements' => [$note, $text], 'fileIds' => []],
        'private_element_ids' => ['note', 'note-text'],
    ]);

    $this->travel(1)->minutes();

    setPrivateWriting($this->actingAs($table['facilitator']), $board, false)->assertNoContent();

    expect($board->elements()->where('is_private', true)->count())->toBe(0)
        ->and($storedBeforeTheDeletion->fresh()->private_element_ids)->toBe(['note', 'note-text'])
        ->and($storedAfterTheReturn->fresh()->private_element_ids)->toBe([]);
});

it('changes nothing when the switch already has that value', function () {
    $board = Whiteboard::factory()->create(['seq' => 5]);
    [$facilitator] = whiteboardFacilitator($board);

    setPrivateWriting($this->actingAs($facilitator), $board, false)->assertNoContent();

    expect($board->fresh()->seq)->toBe(5)
        ->and($board->fresh()->private_writing)->toBeFalse();

    Event::assertNotDispatched(WhiteboardElementsChanged::class);
});

it('reveals without an element event when no note was hidden', function () {
    $board = Whiteboard::factory()->privateWriting()->create(['seq' => 5]);
    [$facilitator] = whiteboardFacilitator($board);

    setPrivateWriting($this->actingAs($facilitator), $board, false)->assertNoContent();

    expect($board->fresh()->seq)->toBe(5)
        ->and($board->fresh()->private_writing)->toBeFalse();

    Event::assertDispatched(WhiteboardChanged::class);
    Event::assertNotDispatched(WhiteboardElementsChanged::class);
});

it('only lets the facilitator switch private writing', function () {
    $table = privateWritingBoard();

    setPrivateWriting($this->actingAs($table['author']), $table['board'], false)->assertForbidden();
    setPrivateWriting(whiteboardViewer($this, $table['guest']), $table['board'], false)->assertForbidden();

    expect($table['board']->fresh()->private_writing)->toBeTrue()
        ->and($table['board']->elements()->where('is_private', true)->count())->toBe(2);
});

it('requires a boolean', function () {
    $board = Whiteboard::factory()->create();
    [$facilitator] = whiteboardFacilitator($board);

    setPrivateWriting($this->actingAs($facilitator), $board, 'maybe')->assertJsonValidationErrors('private_writing');
});

it('refuses duplicate and save as template until the notes are revealed', function () {
    $table = privateWritingBoard();
    $board = $table['board'];

    foreach (['other', 'author', 'facilitator'] as $who) {
        $duplicate = $this->actingAs($table[$who])
            ->postJson(route('whiteboards.duplicate.store', $board))
            ->assertStatus(422)
            ->assertJsonPath('message', 'Reveal the notes first.');

        $template = $this->actingAs($table[$who])
            ->postJson(route('whiteboards.template.store', $board), ['name' => "Kick-off {$who}"])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Reveal the notes first.');

        expect(whiteboardPayloadExposes($duplicate->getContent().$template->getContent(), $table['secret']))->toBeFalse();
    }

    expect(Whiteboard::query()->count())->toBe(1)
        ->and(WhiteboardTemplate::query()->count())->toBe(0)
        ->and(WhiteboardElement::query()->count())->toBe(2);
});

it('copies the notes once they are revealed, and never one deleted while hidden', function () {
    $table = privateWritingBoard();
    $board = $table['board'];
    [$dropped, $droppedText] = stickyWithText('dropped', 'Dropped thought 5522');
    storeWhiteboardElement($board, [...$dropped, 'isDeleted' => true], 3, $table['authorMember'], private: true);
    storeWhiteboardElement($board, [...$droppedText, 'isDeleted' => true], 4, $table['authorMember'], private: true);
    $board->update(['seq' => 4]);

    setPrivateWriting($this->actingAs($table['facilitator']), $board, false)->assertNoContent();

    $this->actingAs($table['other'])->postJson(route('whiteboards.duplicate.store', $board))->assertCreated();
    $this->actingAs($table['other'])->postJson(route('whiteboards.template.store', $board), ['name' => 'Kick-off'])->assertCreated();

    $copy = Whiteboard::query()->whereKeyNot($board->id)->sole();
    $copied = $copy->elements()->get()->map(fn (WhiteboardElement $element): array => $element->data)->all();
    $template = WhiteboardTemplate::query()->sole();

    expect(whiteboardPayloadExposes($copied, $table['secret']))->toBeTrue()
        ->and(whiteboardPayloadExposes($copied, 'Dropped thought'))->toBeFalse()
        ->and($copy->elements()->where('is_private', true)->count())->toBe(0)
        ->and(whiteboardPayloadExposes($template->scene, $table['secret']))->toBeTrue()
        ->and(whiteboardPayloadExposes($template->scene, 'Dropped thought'))->toBeFalse();
});

it('refuses to hide the notes while a vote is open', function () {
    $board = Whiteboard::factory()->create();
    [$facilitator] = whiteboardFacilitator($board);
    whiteboardSticky($board, 'note');
    $session = openWhiteboardVote($board);

    setPrivateWriting($this->actingAs($facilitator), $board, true)
        ->assertStatus(422)
        ->assertJsonPath('message', 'Close the vote first.');

    expect($board->fresh()->private_writing)->toBeFalse();

    $session->update(['closed_at' => now(), 'results' => []]);

    setPrivateWriting($this->actingAs($facilitator), $board, true)->assertNoContent();

    expect($board->fresh()->private_writing)->toBeTrue();
});

it('refuses to open a vote while the notes are hidden', function () {
    $table = privateWritingBoard();

    $this->actingAs($table['facilitator'])
        ->postJson(route('whiteboards.voteSessions.store', $table['board']), ['votes_per_member' => 3, 'allow_multiple' => false])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Reveal the notes first.');

    $this->actingAs($table['author'])
        ->postJson(route('whiteboards.voteSessions.store', $table['board']), ['votes_per_member' => 3, 'allow_multiple' => false])
        ->assertForbidden();

    expect(WhiteboardVoteSession::query()->count())->toBe(0);
});
