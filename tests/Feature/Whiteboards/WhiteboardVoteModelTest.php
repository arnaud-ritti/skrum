<?php

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardVote;
use App\Models\WhiteboardVoteSession;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

it('gives a board safe facilitation defaults', function () {
    $board = Whiteboard::factory()->create()->fresh();

    expect($board->locked)->toBeFalse()
        ->and($board->follow_enabled)->toBeFalse()
        ->and($board->timer_ends_at)->toBeNull()
        ->and($board->voteSessions()->count())->toBe(0);
});

it('stores a vote session and its votes with uuid keys', function () {
    $board = Whiteboard::factory()->create();
    [, $member] = whiteboardMember($board);
    whiteboardSticky($board, 'note');
    $session = openWhiteboardVote($board, ['opened_by_member_id' => $member->id]);
    $vote = castWhiteboardVote($session, $member, 'note', 2);

    $session = $session->fresh();

    expect(Str::isUuid($session->id))->toBeTrue()
        ->and(Str::isUuid($vote->id))->toBeTrue()
        ->and($session->votes_per_member)->toBe(3)
        ->and($session->allow_multiple)->toBeFalse()
        ->and($session->element_ids)->toBe(['note'])
        ->and($session->frame_element_id)->toBeNull()
        ->and($session->opened_by_member_id)->toBe($member->id)
        ->and($session->closed_at)->toBeNull()
        ->and($session->dismissed_at)->toBeNull()
        ->and($session->results)->toBeNull()
        ->and($session->isOpen())->toBeTrue()
        ->and($session->votes()->sole()->count)->toBe(2)
        ->and($session->whiteboard->id)->toBe($board->id)
        ->and($board->voteSessions()->sole()->id)->toBe($session->id);
});

it('counts as a target only a live sticky note the vote was opened on', function () {
    $board = Whiteboard::factory()->create();
    [$note] = whiteboardSticky($board, 'note');
    [$gone] = whiteboardSticky($board, 'gone');
    $plain = WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'plain']);
    $session = openWhiteboardVote($board, ['element_ids' => ['note', 'gone', 'plain']]);
    [$late, $words] = whiteboardSticky($board, 'late');
    $gone->update(['is_deleted' => true]);

    expect($session->isTarget($note))->toBeTrue()
        ->and($session->isTarget($gone))->toBeFalse()
        ->and($session->isTarget($plain))->toBeFalse()
        ->and($session->isTarget($late))->toBeFalse()
        ->and($session->isTarget($words))->toBeFalse()
        ->and($session->isTarget(null))->toBeFalse();
});

it('keeps one open vote per board in the database', function () {
    $board = Whiteboard::factory()->create();
    WhiteboardVoteSession::factory()->closed()->create(['whiteboard_id' => $board->id]);
    WhiteboardVoteSession::factory()->create(['whiteboard_id' => $board->id]);
    WhiteboardVoteSession::factory()->create();

    expect(fn () => WhiteboardVoteSession::factory()->create(['whiteboard_id' => $board->id]))
        ->toThrow(QueryException::class);
});

it('keeps one vote row per member and note', function () {
    $board = Whiteboard::factory()->create();
    [, $member] = whiteboardMember($board);
    $session = openWhiteboardVote($board);
    castWhiteboardVote($session, $member, 'note');

    expect(fn () => castWhiteboardVote($session, $member, 'note'))->toThrow(QueryException::class);
});

it('removes the votes with their board', function () {
    Storage::fake();

    $board = Whiteboard::factory()->create();
    [, $member] = whiteboardMember($board);
    castWhiteboardVote(openWhiteboardVote($board), $member, 'note');

    $board->delete();

    expect(WhiteboardVoteSession::query()->count())->toBe(0)
        ->and(WhiteboardVote::query()->count())->toBe(0);
});
