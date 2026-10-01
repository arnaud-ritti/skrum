<?php

use App\Enums\WorkspaceRole;
use App\Events\Whiteboards\WhiteboardChanged;
use App\Events\Whiteboards\WhiteboardVoteChanged;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardVote;
use App\Models\WhiteboardVoteSession;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;

beforeEach(function () {
    Event::fake([WhiteboardChanged::class, WhiteboardVoteChanged::class]);
});

function openVoteRequest(mixed $test, Whiteboard $board, array $body = []): mixed
{
    return $test->postJson(route('whiteboards.voteSessions.store', $board), ['votes_per_member' => 3, 'allow_multiple' => false, ...$body]);
}

function voteRequest(mixed $test, Whiteboard $board, WhiteboardVoteSession $session, string $elementId, mixed $count): mixed
{
    return $test->putJson(route('whiteboards.voteSessions.votes.update', [$board, $session, $elementId]), ['count' => $count]);
}

function closeVoteRequest(mixed $test, Whiteboard $board, WhiteboardVoteSession $session): mixed
{
    return $test->postJson(route('whiteboards.voteSessions.close.store', [$board, $session]));
}

it('opens a vote on the live sticky notes of the board', function () {
    $board = Whiteboard::factory()->create();
    [$user, $member] = whiteboardFacilitator($board);
    whiteboardSticky($board, 'second');
    whiteboardSticky($board, 'first');
    [$erased] = whiteboardSticky($board, 'erased');
    $erased->update(['is_deleted' => true]);
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'plain']);

    $response = openVoteRequest($this->actingAs($user), $board, ['votes_per_member' => 5, 'allow_multiple' => true])->assertCreated();

    $session = WhiteboardVoteSession::query()->sole();

    $response->assertExactJson(['id' => $session->id]);

    expect($session->whiteboard_id)->toBe($board->id)
        ->and($session->votes_per_member)->toBe(5)
        ->and($session->allow_multiple)->toBeTrue()
        ->and($session->frame_element_id)->toBeNull()
        ->and($session->element_ids)->toBe(['first', 'second'])
        ->and($session->opened_by_member_id)->toBe($member->id)
        ->and($session->isOpen())->toBeTrue();

    Event::assertDispatched(WhiteboardChanged::class, fn (WhiteboardChanged $event) => $event->boardId === $board->id);
});

it('limits a vote to the notes inside a frame', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);
    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id, 'element_id' => 'zone', 'type' => 'frame', 'data' => sceneElement(['id' => 'zone', 'type' => 'frame']),
    ]);
    whiteboardSticky($board, 'inside', 'In', ['frameId' => 'zone']);
    whiteboardSticky($board, 'outside', 'Out');

    openVoteRequest($this->actingAs($user), $board, ['frame_element_id' => 'zone'])->assertCreated();

    $session = WhiteboardVoteSession::query()->sole();

    expect($session->frame_element_id)->toBe('zone')
        ->and($session->element_ids)->toBe(['inside']);
});

it('refuses a frame that is not a live frame of this board', function (string $frameElementId) {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);
    whiteboardSticky($board, 'note');
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'box']);
    WhiteboardElement::factory()->deleted()->create(['whiteboard_id' => $board->id, 'element_id' => 'old', 'type' => 'frame']);
    WhiteboardElement::factory()->create(['element_id' => 'theirs', 'type' => 'frame']);

    openVoteRequest($this->actingAs($user), $board, ['frame_element_id' => $frameElementId])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('frame_element_id');

    expect(WhiteboardVoteSession::query()->count())->toBe(0);
})->with([
    'unknown' => 'nowhere',
    'a rectangle' => 'box',
    'a deleted frame' => 'old',
    'a frame of another board' => 'theirs',
]);

it('lets only the facilitator open a vote', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    whiteboardFacilitator($board);
    [$user] = whiteboardMember($board);
    $guest = whiteboardGuest($board);
    whiteboardSticky($board, 'note');

    openVoteRequest($this->withCookies(whiteboardGuestCookie($guest))->withCredentials(), $board)->assertForbidden();
    openVoteRequest($this->actingAs($user), $board)->assertForbidden();

    expect(WhiteboardVoteSession::query()->count())->toBe(0);
});

it('refuses a second vote while one is open', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);
    whiteboardSticky($board, 'note');
    openWhiteboardVote($board);

    openVoteRequest($this->actingAs($user), $board)
        ->assertUnprocessable()
        ->assertJsonPath('message', 'A vote is already open.');

    expect(WhiteboardVoteSession::query()->count())->toBe(1);
});

it('refuses a vote when no sticky note is in scope', function (?string $frameElementId) {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'zone', 'type' => 'frame']);
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'plain']);

    if ($frameElementId !== null) {
        whiteboardSticky($board, 'outside');
    }

    openVoteRequest($this->actingAs($user), $board, ['frame_element_id' => $frameElementId])
        ->assertUnprocessable()
        ->assertJsonPath('message', 'There are no sticky notes to vote on.');

    expect(WhiteboardVoteSession::query()->count())->toBe(0);
})->with([
    'a board without notes' => [null],
    'a frame without notes' => ['zone'],
]);

it('validates the settings of a vote', function (array $body, string $field) {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);
    whiteboardSticky($board, 'note');

    $this->actingAs($user)
        ->postJson(route('whiteboards.voteSessions.store', $board), $body)
        ->assertJsonValidationErrors($field);

    expect(WhiteboardVoteSession::query()->count())->toBe(0);
})->with([
    'no budget' => [['allow_multiple' => false], 'votes_per_member'],
    'a budget of zero' => [['votes_per_member' => 0, 'allow_multiple' => false], 'votes_per_member'],
    'a budget above twenty' => [['votes_per_member' => 21, 'allow_multiple' => false], 'votes_per_member'],
    'no multiple flag' => [['votes_per_member' => 3], 'allow_multiple'],
    'a flag that is not a boolean' => [['votes_per_member' => 3, 'allow_multiple' => 'maybe'], 'allow_multiple'],
    'a frame id that cannot be an element id' => [['votes_per_member' => 3, 'allow_multiple' => false, 'frame_element_id' => 'not an id!'], 'frame_element_id'],
]);

it('puts the previous results away when a new vote opens', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);
    whiteboardSticky($board, 'note');
    $previous = WhiteboardVoteSession::factory()
        ->closed([['elementId' => 'note', 'text' => 'Idea', 'count' => 2]])
        ->create(['whiteboard_id' => $board->id, 'element_ids' => ['note']]);

    openVoteRequest($this->actingAs($user), $board)->assertCreated();

    expect($previous->fresh()->dismissed_at)->not->toBeNull()
        ->and(WhiteboardVoteSession::query()->whereNull('closed_at')->count())->toBe(1);
});

it('casts, raises and removes a vote and answers with the voter\'s own tally', function () {
    $board = Whiteboard::factory()->create();
    whiteboardFacilitator($board);
    [$user, $member] = whiteboardMember($board);
    whiteboardSticky($board, 'first');
    whiteboardSticky($board, 'second');
    $session = openWhiteboardVote($board, ['allow_multiple' => true]);

    voteRequest($this->actingAs($user), $board, $session, 'first', 2)
        ->assertOk()
        ->assertExactJson(['myVotes' => [['elementId' => 'first', 'count' => 2]], 'remaining' => 1, 'finishedCount' => 0]);

    voteRequest($this->actingAs($user), $board, $session, 'second', 1)
        ->assertOk()
        ->assertExactJson([
            'myVotes' => [['elementId' => 'first', 'count' => 2], ['elementId' => 'second', 'count' => 1]],
            'remaining' => 0,
            'finishedCount' => 1,
        ]);

    voteRequest($this->actingAs($user), $board, $session, 'first', 0)
        ->assertOk()
        ->assertExactJson(['myVotes' => [['elementId' => 'second', 'count' => 1]], 'remaining' => 2, 'finishedCount' => 0]);

    expect(WhiteboardVote::query()->where('whiteboard_member_id', $member->id)->pluck('count', 'element_id')->all())
        ->toBe(['second' => 1]);
});

it('never lets a member spend more than the budget', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    whiteboardSticky($board, 'first');
    whiteboardSticky($board, 'second');
    $session = openWhiteboardVote($board, ['allow_multiple' => true]);

    voteRequest($this->actingAs($user), $board, $session, 'first', 3)->assertOk();

    voteRequest($this->actingAs($user), $board, $session, 'second', 1)
        ->assertUnprocessable()
        ->assertJsonPath('message', 'You have no votes left.');

    voteRequest($this->actingAs($user), $board, $session, 'first', 4)
        ->assertUnprocessable()
        ->assertJsonPath('message', 'You have no votes left.');

    voteRequest($this->actingAs($user), $board, $session, 'first', 2)->assertOk();
    voteRequest($this->actingAs($user), $board, $session, 'second', 1)->assertOk()->assertJsonPath('remaining', 0);

    expect((int) WhiteboardVote::query()->sum('count'))->toBe(3);
});

it('allows several votes on one note only when the vote says so', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    whiteboardSticky($board, 'note');
    $session = openWhiteboardVote($board);

    voteRequest($this->actingAs($user), $board, $session, 'note', 2)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('count')
        ->assertJsonPath('message', 'Only one vote per note is allowed.');

    voteRequest($this->actingAs($user), $board, $session, 'note', 1)->assertOk();

    expect(WhiteboardVote::query()->sole()->count)->toBe(1);
});

it('refuses a vote on anything but a live sticky note of the vote', function (string $elementId) {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    whiteboardSticky($board, 'note');
    [$erased] = whiteboardSticky($board, 'erased');
    $session = openWhiteboardVote($board);
    $erased->update(['is_deleted' => true]);
    whiteboardSticky($board, 'late');
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'plain']);

    voteRequest($this->actingAs($user), $board, $session, $elementId, 1)
        ->assertUnprocessable()
        ->assertJsonPath('message', 'This note is not part of the vote.');

    expect(WhiteboardVote::query()->count())->toBe(0);
})->with([
    'a plain shape' => 'plain',
    'a deleted note' => 'erased',
    'a note added after the vote opened' => 'late',
    'the text of a note' => 'note-text',
    'nothing on the board' => 'nowhere',
]);

it('refuses a vote once the vote is closed', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    whiteboardSticky($board, 'note');
    $session = WhiteboardVoteSession::factory()->closed()->create(['whiteboard_id' => $board->id, 'element_ids' => ['note']]);

    voteRequest($this->actingAs($user), $board, $session, 'note', 1)
        ->assertUnprocessable()
        ->assertJsonPath('message', 'This vote is closed.');

    expect(WhiteboardVote::query()->count())->toBe(0);
});

it('lets guests vote, and always in their own name', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    [, $member] = whiteboardMember($board);
    $guest = whiteboardGuest($board);
    whiteboardSticky($board, 'note');
    $session = openWhiteboardVote($board);

    $this->withCookies(whiteboardGuestCookie($guest))->withCredentials()
        ->putJson(route('whiteboards.voteSessions.votes.update', [$board, $session, 'note']), [
            'count' => 1, 'member_id' => $member->id, 'whiteboard_member_id' => $member->id,
        ])
        ->assertOk()
        ->assertJsonPath('remaining', 2);

    expect(WhiteboardVote::query()->sole()->whiteboard_member_id)->toBe($guest->id);
});

it('keeps voting open on a locked board', function () {
    $board = Whiteboard::factory()->create(['locked' => true]);
    whiteboardFacilitator($board);
    [$user] = whiteboardMember($board);
    whiteboardSticky($board, 'note');
    $session = openWhiteboardVote($board);

    voteRequest($this->actingAs($user), $board, $session, 'note', 1)->assertOk();

    expect(WhiteboardVote::query()->count())->toBe(1);
});

it('does not find the vote of another board', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);
    $other = Whiteboard::factory()->create();
    whiteboardSticky($other, 'note');
    $theirs = openWhiteboardVote($other);

    voteRequest($this->actingAs($user), $board, $theirs, 'note', 1)->assertNotFound();
    closeVoteRequest($this->actingAs($user), $board, $theirs)->assertNotFound();
    $this->actingAs($user)->postJson(route('whiteboards.voteSessions.dismiss.store', [$board, $theirs]))->assertNotFound();
    $this->actingAs($user)->getJson(route('whiteboards.voteSessions.show', [$board, $theirs]))->assertNotFound();

    expect($theirs->fresh()->isOpen())->toBeTrue();
});

it('refuses people outside the team on every facilitation endpoint', function () {
    $board = Whiteboard::factory()->create();
    whiteboardSticky($board, 'note');
    $session = openWhiteboardVote($board);
    $outsider = User::factory()->create();
    $board->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)->putJson(route('whiteboards.timer.update', $board), ['seconds' => 60])->assertForbidden();
    openVoteRequest($this->actingAs($outsider), $board)->assertForbidden();
    voteRequest($this->actingAs($outsider), $board, $session, 'note', 1)->assertForbidden();
    closeVoteRequest($this->actingAs($outsider), $board, $session)->assertForbidden();
    $this->actingAs($outsider)->postJson(route('whiteboards.voteSessions.dismiss.store', [$board, $session]))->assertForbidden();
    $this->actingAs($outsider)->getJson(route('whiteboards.voteSessions.show', [$board, $session]))->assertForbidden();

    expect(WhiteboardVote::query()->count())->toBe(0)
        ->and(WhiteboardVoteSession::query()->count())->toBe(1)
        ->and($session->fresh()->isOpen())->toBeTrue()
        ->and($board->fresh()->timer_ends_at)->toBeNull();
});

it('validates the count', function (array $body) {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    whiteboardSticky($board, 'note');
    $session = openWhiteboardVote($board, ['allow_multiple' => true, 'votes_per_member' => 20]);

    $this->actingAs($user)
        ->putJson(route('whiteboards.voteSessions.votes.update', [$board, $session, 'note']), $body)
        ->assertJsonValidationErrors('count');
})->with([
    'missing' => [[]],
    'negative' => [['count' => -1]],
    'above twenty' => [['count' => 21]],
    'not a number' => [['count' => 'two']],
]);

it('broadcasts progress to the others and stays quiet when nothing changed', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    whiteboardSticky($board, 'first');
    whiteboardSticky($board, 'second');
    $session = openWhiteboardVote($board, ['votes_per_member' => 1]);

    voteRequest($this->actingAs($user), $board, $session, 'first', 1)->assertOk();

    Event::assertDispatched(WhiteboardVoteChanged::class, fn (WhiteboardVoteChanged $event) => $event->boardId === $board->id
        && $event->broadcastAs() === 'vote.changed'
        && $event->broadcastWith() === ['sessionId' => $session->id, 'finishedCount' => 1]);

    voteRequest($this->actingAs($user), $board, $session, 'first', 1)
        ->assertOk()
        ->assertExactJson(['myVotes' => [['elementId' => 'first', 'count' => 1]], 'remaining' => 0, 'finishedCount' => 1]);

    voteRequest($this->actingAs($user), $board, $session, 'second', 0)->assertOk();

    Event::assertDispatchedTimes(WhiteboardVoteChanged::class, 1);
    expect(WhiteboardVote::query()->count())->toBe(1);
});

it('keeps element ids that look like numbers as strings', function () {
    $board = Whiteboard::factory()->create();
    [$facilitator] = whiteboardFacilitator($board);
    [$user] = whiteboardMember($board);
    whiteboardSticky($board, '0', 'Zero');
    whiteboardSticky($board, '12', 'Twelve');
    $session = openWhiteboardVote($board, ['allow_multiple' => true]);

    voteRequest($this->actingAs($user), $board, $session, '0', 1)
        ->assertOk()
        ->assertExactJson(['myVotes' => [['elementId' => '0', 'count' => 1]], 'remaining' => 2, 'finishedCount' => 0]);

    voteRequest($this->actingAs($user), $board, $session, '12', 2)
        ->assertOk()
        ->assertJsonPath('myVotes', [['elementId' => '0', 'count' => 1], ['elementId' => '12', 'count' => 2]]);

    closeVoteRequest($this->actingAs($facilitator), $board, $session)->assertNoContent();

    expect($session->fresh()->results)->toBe([
        ['elementId' => '12', 'text' => 'Twelve', 'count' => 2],
        ['elementId' => '0', 'text' => 'Zero', 'count' => 1],
    ]);
});

it('closes the vote with ranked results and forgets who voted', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);
    [, $ann] = whiteboardMember($board);
    [, $bob] = whiteboardMember($board);
    whiteboardSticky($board, 'low-right', 'Right', ['x' => 500, 'y' => 300]);
    whiteboardSticky($board, 'low-left', 'Left', ['x' => 0, 'y' => 300]);
    whiteboardSticky($board, 'top', str_repeat('é', 250), ['x' => 900, 'y' => 0]);
    whiteboardSticky($board, 'winner', 'Winner', ['x' => 900, 'y' => 900]);
    whiteboardSticky($board, 'unloved', 'Nobody', ['x' => 0, 'y' => 0]);
    $session = openWhiteboardVote($board, ['allow_multiple' => true, 'votes_per_member' => 5]);

    castWhiteboardVote($session, $ann, 'winner', 2);
    castWhiteboardVote($session, $bob, 'winner', 1);
    castWhiteboardVote($session, $ann, 'low-right');
    castWhiteboardVote($session, $bob, 'low-left');
    castWhiteboardVote($session, $ann, 'top');

    closeVoteRequest($this->actingAs($user), $board, $session)->assertNoContent();

    $session->refresh();

    expect($session->closed_at)->not->toBeNull()
        ->and($session->dismissed_at)->toBeNull()
        ->and($session->results)->toBe([
            ['elementId' => 'winner', 'text' => 'Winner', 'count' => 3],
            ['elementId' => 'top', 'text' => str_repeat('é', 200), 'count' => 1],
            ['elementId' => 'low-left', 'text' => 'Left', 'count' => 1],
            ['elementId' => 'low-right', 'text' => 'Right', 'count' => 1],
        ])
        ->and(WhiteboardVote::query()->count())->toBe(0)
        ->and(json_encode($session->results))->not->toContain($ann->id)
        ->and(json_encode($session->results))->not->toContain($bob->id);

    Event::assertDispatched(WhiteboardChanged::class, fn (WhiteboardChanged $event) => $event->boardId === $board->id);
});

it('leaves a note that is gone out of the results and gives a note without text an empty label', function () {
    $board = Whiteboard::factory()->create();
    [$user, $member] = whiteboardFacilitator($board);
    [$gone] = whiteboardSticky($board, 'gone');
    [, $words] = whiteboardSticky($board, 'bare');
    $session = openWhiteboardVote($board);
    castWhiteboardVote($session, $member, 'gone');
    castWhiteboardVote($session, $member, 'bare');
    $gone->update(['is_deleted' => true]);
    $words->update(['is_deleted' => true]);

    closeVoteRequest($this->actingAs($user), $board, $session)->assertNoContent();

    expect($session->fresh()->results)->toBe([['elementId' => 'bare', 'text' => '', 'count' => 1]]);
});

it('closes a vote once', function () {
    $board = Whiteboard::factory()->create();
    [$user, $member] = whiteboardFacilitator($board);
    whiteboardSticky($board, 'note');
    $session = openWhiteboardVote($board);
    castWhiteboardVote($session, $member, 'note');

    closeVoteRequest($this->actingAs($user), $board, $session)->assertNoContent();

    $closedAt = $session->fresh()->closed_at;
    $this->travel(5)->minutes();

    closeVoteRequest($this->actingAs($user), $board, $session)->assertNoContent();

    expect($session->fresh()->closed_at->equalTo($closedAt))->toBeTrue()
        ->and($session->fresh()->results)->toBe([['elementId' => 'note', 'text' => 'Idea', 'count' => 1]]);

    Event::assertDispatchedTimes(WhiteboardChanged::class, 1);
});

it('lets only the facilitator close and dismiss', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    whiteboardFacilitator($board);
    [$user] = whiteboardMember($board);
    $guest = whiteboardGuest($board);
    whiteboardSticky($board, 'note');
    $open = openWhiteboardVote($board);

    closeVoteRequest($this->withCookies(whiteboardGuestCookie($guest))->withCredentials(), $board, $open)->assertForbidden();
    closeVoteRequest($this->actingAs($user), $board, $open)->assertForbidden();

    expect($open->fresh()->isOpen())->toBeTrue();

    $open->update(['closed_at' => now(), 'results' => []]);

    $this->actingAs($user)
        ->postJson(route('whiteboards.voteSessions.dismiss.store', [$board, $open]))
        ->assertForbidden();

    expect($open->fresh()->dismissed_at)->toBeNull();
});

it('hides the results when the facilitator dismisses them, once', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);
    $session = WhiteboardVoteSession::factory()
        ->closed([['elementId' => 'note', 'text' => 'Idea', 'count' => 1]])
        ->create(['whiteboard_id' => $board->id]);

    $this->actingAs($user)->postJson(route('whiteboards.voteSessions.dismiss.store', [$board, $session]))->assertNoContent();
    $this->actingAs($user)->postJson(route('whiteboards.voteSessions.dismiss.store', [$board, $session]))->assertNoContent();

    expect($session->fresh()->dismissed_at)->not->toBeNull();

    $this->actingAs($user)->getJson(route('whiteboards.snapshot.show', $board))->assertJsonPath('voting', null);

    Event::assertDispatchedTimes(WhiteboardChanged::class, 1);
});

it('refuses to dismiss a vote that is still open', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);
    $session = openWhiteboardVote($board);

    $this->actingAs($user)
        ->postJson(route('whiteboards.voteSessions.dismiss.store', [$board, $session]))
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Close the vote first.');

    expect($session->fresh()->dismissed_at)->toBeNull();
});

it('has no voting state on a board that never voted', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('voting', null)
        ->assertJsonPath('votingHistory', []);
});

it('lists past votes for members, newest first, and never for guests', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    [$user] = whiteboardMember($board);
    $guest = whiteboardGuest($board);
    $result = fn (string $text): array => [['elementId' => 'note', 'text' => $text, 'count' => 1]];
    $old = WhiteboardVoteSession::factory()->closed($result('Old'))->create([
        'whiteboard_id' => $board->id, 'closed_at' => now()->subDays(2), 'dismissed_at' => now()->subDays(2),
    ]);
    $recent = WhiteboardVoteSession::factory()->closed($result('Recent'))->create([
        'whiteboard_id' => $board->id, 'closed_at' => now()->subDay(), 'dismissed_at' => now()->subDay(),
    ]);
    WhiteboardVoteSession::factory()->closed()->create([
        'whiteboard_id' => $board->id, 'closed_at' => now()->subHours(2), 'dismissed_at' => now()->subHours(2),
    ]);
    $current = WhiteboardVoteSession::factory()->closed($result('Now'))->create(['whiteboard_id' => $board->id]);

    $this->withCookies(whiteboardGuestCookie($guest))->withCredentials()
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('voting.id', $current->id)
        ->assertJsonPath('voting.results.0.text', 'Now')
        ->assertJsonPath('votingHistory', []);

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('voting.id', $current->id)
        ->assertJsonPath('votingHistory.*.id', [$recent->id, $old->id])
        ->assertJsonPath('votingHistory.0.results', $result('Recent'))
        ->assertJsonPath('votingHistory.0.closedAt', $recent->closed_at->toIso8601String());
});

it('keeps the history to the ten most recent votes', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    foreach (range(1, 12) as $daysAgo) {
        WhiteboardVoteSession::factory()->closed([['elementId' => 'note', 'text' => "Day {$daysAgo}", 'count' => 1]])->create([
            'whiteboard_id' => $board->id, 'closed_at' => now()->subDays($daysAgo), 'dismissed_at' => now()->subDays($daysAgo),
        ]);
    }

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonCount(10, 'votingHistory')
        ->assertJsonPath('votingHistory.0.results.0.text', 'Day 1')
        ->assertJsonPath('votingHistory.9.results.0.text', 'Day 10');
});

it('throttles votes with the whiteboard limiter', function () {
    expect(Route::getRoutes()->getByName('whiteboards.voteSessions.votes.update')->gatherMiddleware())
        ->toContain('throttle:whiteboard-writes');
});
