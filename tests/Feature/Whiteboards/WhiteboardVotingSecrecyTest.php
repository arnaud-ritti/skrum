<?php

use App\Events\Whiteboards\WhiteboardChanged;
use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Events\Whiteboards\WhiteboardVoteChanged;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardVote;
use App\Models\WhiteboardVoteSession;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;

beforeEach(function () {
    Event::fake([WhiteboardChanged::class, WhiteboardVoteChanged::class, WhiteboardElementsChanged::class]);
});

/**
 * A board with two notes and an open vote (3 votes each, several per note).
 * Bob has spent his budget (2 on the first note, 1 on the second), the guest
 * has voted once for the second note; Ann and the facilitator have not voted.
 *
 * @return array{
 *     board: Whiteboard,
 *     session: WhiteboardVoteSession,
 *     facilitator: array{0: User, 1: WhiteboardMember},
 *     ann: array{0: User, 1: WhiteboardMember},
 *     bob: array{0: User, 1: WhiteboardMember},
 *     guest: WhiteboardMember
 * }
 */
function votingRoom(): array
{
    $board = Whiteboard::factory()->withGuestAccess()->create();
    $facilitator = whiteboardFacilitator($board);
    $ann = whiteboardMember($board);
    $bob = whiteboardMember($board);
    $guest = whiteboardGuest($board);
    whiteboardSticky($board, 'first', 'First idea');
    whiteboardSticky($board, 'second', 'Second idea');
    $session = openWhiteboardVote($board, ['allow_multiple' => true, 'opened_by_member_id' => $facilitator[1]->id]);

    castWhiteboardVote($session, $bob[1], 'first', 2);
    castWhiteboardVote($session, $bob[1], 'second', 1);
    castWhiteboardVote($session, $guest, 'second', 1);

    return ['board' => $board, 'session' => $session, 'facilitator' => $facilitator, 'ann' => $ann, 'bob' => $bob, 'guest' => $guest];
}

/**
 * @param  list<array{elementId: string, count: int}>  $myVotes
 * @return array<string, mixed>
 */
function openVotingFor(WhiteboardVoteSession $session, array $myVotes, int $remaining, int $finishedCount = 1): array
{
    return [
        'id' => $session->id,
        'open' => true,
        'votesPerMember' => 3,
        'allowMultiple' => true,
        'frameElementId' => null,
        'elementIds' => ['first', 'second'],
        'myVotes' => $myVotes,
        'remaining' => $remaining,
        'finishedCount' => $finishedCount,
        'results' => null,
    ];
}

it('shows someone who has not voted nothing about the votes of the others', function (string $who) {
    $room = votingRoom();
    [$user] = $room[$who];
    $expected = openVotingFor($room['session'], [], 3);

    $snapshot = $this->actingAs($user)->getJson(route('whiteboards.snapshot.show', $room['board']))->assertOk();

    expect($snapshot->json('voting'))->toBe($expected)
        ->and($snapshot->json('votingHistory'))->toBe([])
        ->and($snapshot->getContent())->not->toContain('"count"');

    $this->actingAs($user)
        ->get(route('whiteboards.show', $room['board']))
        ->assertInertia(fn ($page) => $page->where('snapshot.voting', $expected)->where('snapshot.votingHistory', []));

    $this->actingAs($user)
        ->getJson(route('whiteboards.voteSessions.show', [$room['board'], $room['session']]))
        ->assertOk()
        ->assertExactJson($expected);
})->with([
    'the facilitator' => 'facilitator',
    'another member' => 'ann',
]);

it('shows a voter their own votes and nobody else\'s', function () {
    $room = votingRoom();

    $forGuest = $this->withCookies(whiteboardGuestCookie($room['guest']))->withCredentials()
        ->getJson(route('whiteboards.snapshot.show', $room['board']))
        ->assertOk();

    expect($forGuest->json('voting'))->toBe(openVotingFor($room['session'], [['elementId' => 'second', 'count' => 1]], 2));

    $forBob = $this->actingAs($room['bob'][0])
        ->getJson(route('whiteboards.snapshot.show', $room['board']))
        ->assertOk();

    expect($forBob->json('voting'))->toBe(openVotingFor($room['session'], [
        ['elementId' => 'first', 'count' => 2],
        ['elementId' => 'second', 'count' => 1],
    ], 0));
});

it('answers a vote with the voter\'s tally and nothing about the others', function () {
    $room = votingRoom();
    [$user] = $room['ann'];

    $this->actingAs($user)
        ->putJson(route('whiteboards.voteSessions.votes.update', [$room['board'], $room['session'], 'first']), ['count' => 1])
        ->assertOk()
        ->assertExactJson(['myVotes' => [['elementId' => 'first', 'count' => 1]], 'remaining' => 2, 'finishedCount' => 1]);

    $this->actingAs($user)
        ->putJson(route('whiteboards.voteSessions.votes.update', [$room['board'], $room['session'], 'second']), ['count' => 4])
        ->assertUnprocessable()
        ->assertExactJson(['message' => 'You have no votes left.', 'errors' => ['votes' => ['You have no votes left.']]]);
});

it('broadcasts progress without saying who voted or for what', function () {
    $room = votingRoom();
    [$user] = $room['ann'];

    $this->actingAs($user)
        ->putJson(route('whiteboards.voteSessions.votes.update', [$room['board'], $room['session'], 'first']), ['count' => 3])
        ->assertOk();

    Event::assertDispatched(WhiteboardVoteChanged::class, function (WhiteboardVoteChanged $event) use ($room) {
        $properties = array_keys(get_object_vars($event));
        sort($properties);

        return $event->broadcastWith() === ['sessionId' => $room['session']->id, 'finishedCount' => 2]
            && $properties === ['boardId', 'finishedCount', 'sessionId', 'socket'];
    });

    Event::assertDispatchedTimes(WhiteboardVoteChanged::class, 1);
    Event::assertNotDispatched(WhiteboardChanged::class);
});

it('keeps votes out of every element payload', function () {
    $room = votingRoom();
    [$user] = $room['facilitator'];
    $board = $room['board'];
    $stored = fn (): array => $board->elements()->get()->mapWithKeys(fn ($element) => [$element->element_id => $element->data])->all();

    $delta = $this->actingAs($user)->getJson(route('whiteboards.elements.index', [$board, 'since' => 0]))->assertOk();
    $snapshot = $this->actingAs($user)->getJson(route('whiteboards.snapshot.show', $board))->assertOk();

    expect($delta->json('elements'))->toHaveCount(4)
        ->and($snapshot->json('elements'))->toHaveCount(4);

    foreach ([...$delta->json('elements'), ...$snapshot->json('elements')] as $element) {
        expect($element)->toEqual($stored()[$element['id']]);
    }

    $this->actingAs($user)
        ->putJson(route('whiteboards.elements.update', $board), ['elements' => [sceneElement(['id' => 'box'])]])
        ->assertOk()
        ->assertExactJson(['seq' => 1, 'fromSeq' => 0, 'rejected' => []]);

    Event::assertDispatched(WhiteboardElementsChanged::class, fn (WhiteboardElementsChanged $event) => $event->broadcastWith() == [
        'seq' => 1, 'fromSeq' => 0, 'elements' => [$stored()['box']],
    ]);
});

it('writes nothing about votes to the log', function () {
    $logged = [];
    Log::listen(function (MessageLogged $message) use (&$logged): void {
        $logged[] = $message->message.json_encode($message->context);
    });

    $room = votingRoom();

    $this->actingAs($room['ann'][0])
        ->putJson(route('whiteboards.voteSessions.votes.update', [$room['board'], $room['session'], 'first']), ['count' => 1])
        ->assertOk();
    $this->actingAs($room['ann'][0])
        ->putJson(route('whiteboards.voteSessions.votes.update', [$room['board'], $room['session'], 'second']), ['count' => 9])
        ->assertUnprocessable();
    $this->actingAs($room['facilitator'][0])->getJson(route('whiteboards.snapshot.show', $room['board']))->assertOk();
    $this->actingAs($room['facilitator'][0])
        ->postJson(route('whiteboards.voteSessions.close.store', [$room['board'], $room['session']]))
        ->assertNoContent();

    expect($logged)->toBe([]);
});

it('shows everyone the same counts after the close, and never who voted', function () {
    $room = votingRoom();

    $this->actingAs($room['facilitator'][0])
        ->postJson(route('whiteboards.voteSessions.close.store', [$room['board'], $room['session']]))
        ->assertNoContent();

    Event::assertDispatched(WhiteboardChanged::class, fn (WhiteboardChanged $event) => $event->broadcastWith() === []);

    $expected = [
        'id' => $room['session']->id,
        'open' => false,
        'votesPerMember' => 3,
        'allowMultiple' => true,
        'frameElementId' => null,
        'elementIds' => [],
        'myVotes' => [],
        'remaining' => 0,
        'finishedCount' => null,
        'results' => [
            ['elementId' => 'first', 'text' => 'First idea', 'count' => 2],
            ['elementId' => 'second', 'text' => 'Second idea', 'count' => 2],
        ],
    ];

    $memberIds = [$room['facilitator'][1]->id, $room['ann'][1]->id, $room['bob'][1]->id, $room['guest']->id];

    auth()->logout();

    $asGuest = $this->withCookies(whiteboardGuestCookie($room['guest']))->withCredentials()
        ->getJson(route('whiteboards.snapshot.show', $room['board']))
        ->assertOk();

    expect($asGuest->json('voting'))->toBe($expected);

    foreach (['facilitator', 'ann', 'bob'] as $who) {
        $voting = $this->actingAs($room[$who][0])
            ->getJson(route('whiteboards.snapshot.show', $room['board']))
            ->assertOk()
            ->json('voting');

        expect($voting)->toBe($expected);

        foreach ($memberIds as $memberId) {
            expect(json_encode($voting))->not->toContain($memberId);
        }
    }

    expect(WhiteboardVote::query()->count())->toBe(0);
});
