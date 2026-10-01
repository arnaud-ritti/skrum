<?php

namespace App\Actions\Whiteboards;

use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardVote;
use App\Models\WhiteboardVoteSession;
use Illuminate\Support\Collection;

/**
 * The only place voting state is turned into a payload. While a session is
 * open a viewer gets their own votes and nothing about anyone else's (spec
 * §11.4); the facilitator is a viewer like any other.
 *
 * @phpstan-type VoteCount array{elementId: string, count: int}
 * @phpstan-type VoteResult array{elementId: string, text: string, count: int}
 * @phpstan-type Tally array{myVotes: list<VoteCount>, remaining: int, finishedCount: int}
 * @phpstan-type Voting array{
 *     id: string,
 *     open: bool,
 *     votesPerMember: int,
 *     allowMultiple: bool,
 *     frameElementId: ?string,
 *     elementIds: list<string>,
 *     myVotes: list<VoteCount>,
 *     remaining: int,
 *     finishedCount: ?int,
 *     results: ?list<VoteResult>
 * }
 * @phpstan-type PastVote array{id: string, closedAt: string, results: list<VoteResult>}
 */
class PresentWhiteboardVoting
{
    public const HistoryLength = 10;

    public function currentSession(Whiteboard $board): ?WhiteboardVoteSession
    {
        return $board->voteSessions()->whereNull('closed_at')->first()
            ?? $board->voteSessions()->whereNull('dismissed_at')->orderByDesc('closed_at')->orderByDesc('id')->first();
    }

    /**
     * @return Voting|null
     */
    public function current(Whiteboard $board, WhiteboardMember $viewer): ?array
    {
        $session = $this->currentSession($board);

        if ($session === null) {
            return null;
        }

        return $this->session($session, $viewer);
    }

    /**
     * @return Voting
     */
    public function session(WhiteboardVoteSession $session, WhiteboardMember $viewer): array
    {
        $settings = [
            'id' => $session->id,
            'open' => $session->isOpen(),
            'votesPerMember' => $session->votes_per_member,
            'allowMultiple' => $session->allow_multiple,
            'frameElementId' => $session->frame_element_id,
        ];

        if (! $session->isOpen()) {
            return [...$settings, 'elementIds' => [], 'myVotes' => [], 'remaining' => 0, 'finishedCount' => null, 'results' => $session->results ?? []];
        }

        return [...$settings, 'elementIds' => $session->element_ids, ...$this->tally($session, $viewer), 'results' => null];
    }

    /**
     * @return Tally
     */
    public function tally(WhiteboardVoteSession $session, WhiteboardMember $member): array
    {
        $mine = $session->votes()->where('whiteboard_member_id', $member->id)->orderBy('element_id')->get();

        return [
            'myVotes' => array_values($mine
                ->map(fn (WhiteboardVote $vote): array => ['elementId' => $vote->element_id, 'count' => $vote->count])
                ->all()),
            'remaining' => max(0, $session->votes_per_member - (int) $mine->sum('count')),
            'finishedCount' => $this->finishedCount($session),
        ];
    }

    public function finishedCount(WhiteboardVoteSession $session): int
    {
        return $session->votes()
            ->get(['whiteboard_member_id', 'count'])
            ->groupBy('whiteboard_member_id')
            ->filter(fn (Collection $votes): bool => (int) $votes->sum('count') >= $session->votes_per_member)
            ->count();
    }

    /**
     * @return list<PastVote>
     */
    public function history(Whiteboard $board, WhiteboardMember $viewer): array
    {
        if ($viewer->isGuest()) {
            return [];
        }

        $current = $this->currentSession($board);

        return array_values($board->voteSessions()
            ->whereNotNull('closed_at')
            ->when($current !== null, fn ($query) => $query->whereKeyNot($current->id))
            ->orderByDesc('closed_at')
            ->orderByDesc('id')
            ->get()
            ->filter(fn (WhiteboardVoteSession $session): bool => ($session->results ?? []) !== [])
            ->take(self::HistoryLength)
            ->map(fn (WhiteboardVoteSession $session): array => [
                'id' => $session->id,
                'closedAt' => $session->closed_at->toIso8601String(),
                'results' => $session->results,
            ])
            ->all());
    }
}
