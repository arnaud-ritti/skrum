<?php

namespace App\Actions\Whiteboards;

use App\Actions\Teams\FacilitatorCandidates;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;
use App\Support\EmojiData;
use App\Support\Sessions\JoinCodes;

/**
 * @phpstan-type Snapshot array{
 *     board: array{
 *         id: string,
 *         title: string,
 *         teamId: string,
 *         facilitatorMemberId: ?string,
 *         guestAccessEnabled: bool,
 *         guestUrl: ?string,
 *         joinCode: ?string,
 *         cursorsEnabled: bool,
 *         reactionsEnabled: bool,
 *         locked: bool,
 *         followEnabled: bool,
 *         timerEndsAt: ?string,
 *         teamName: ?string
 *     },
 *     me: array{
 *         id: string,
 *         userId: ?string,
 *         name: string,
 *         avatarUrl: string,
 *         isGuest: bool,
 *         isFacilitator: bool,
 *         canTakeControl: bool,
 *         canDelete: bool,
 *         transferCandidates: array<int, array{userId: string, name: string, avatarUrl: string}>
 *     },
 *     members: array<int, array{id: string, name: string, avatarUrl: string, isGuest: bool}>,
 *     elements: array<int, array<string, mixed>>,
 *     seq: int,
 *     links: array{
 *         team: ?string,
 *         sessions: ?string
 *     },
 *     emojiData: array{baseUrl: string, locale: string},
 *     viewerIsObserver: bool,
 *     serverTime: string
 * }
 */
class BuildWhiteboardSnapshot
{
    public const int TimerLingerMinutes = 5;

    public function __construct(
        private FacilitatorCandidates $facilitatorCandidates,
        private OrderWhiteboardElements $orderWhiteboardElements,
        private JoinCodes $joinCodes,
    ) {}

    /**
     * @return Snapshot
     */
    public function handle(Whiteboard $board, WhiteboardMember $viewer): array
    {
        $board->load(['team.workspace', 'members.user']);
        $viewer->loadMissing('user');

        $isGuest = $viewer->isGuest();
        $isFacilitator = $board->isFacilitator($viewer);
        $isManager = (bool) $viewer->user?->canManage($board->team->workspace);

        return [
            'board' => [
                'id' => $board->id,
                'title' => $board->title,
                'teamId' => $board->team_id,
                'facilitatorMemberId' => $board->facilitator_member_id,
                'guestAccessEnabled' => $board->guest_access_enabled,
                'guestUrl' => $isGuest ? null : route('whiteboards.join.show', $board->guest_token),
                'joinCode' => $isGuest ? null : $this->joinCodes->for($board),
                'cursorsEnabled' => $board->cursors_enabled,
                'reactionsEnabled' => $board->reactions_enabled,
                'locked' => $board->locked,
                'followEnabled' => $board->follow_enabled,
                'timerEndsAt' => $this->timerEndsAt($board),
                'teamName' => $isGuest ? null : $board->team->name,
            ],
            'me' => [
                'id' => $viewer->id,
                'userId' => $viewer->user_id,
                'name' => $viewer->displayName(),
                'avatarUrl' => $viewer->avatarUrl(),
                'isGuest' => $isGuest,
                'isFacilitator' => $isFacilitator,
                'canTakeControl' => ! $isGuest && ! $isFacilitator,
                'canDelete' => $isFacilitator || $isManager,
                'transferCandidates' => $isFacilitator && ! $isGuest ? $this->facilitatorCandidates->handle($board->team, $viewer->user_id) : [],
            ],
            'members' => $board->members
                ->map(fn (WhiteboardMember $member): array => [
                    'id' => $member->id,
                    'name' => $member->displayName(),
                    'avatarUrl' => $member->avatarUrl(),
                    'isGuest' => $member->isGuest(),
                ])
                ->values()
                ->all(),
            'elements' => $this->orderWhiteboardElements
                ->handle($board->elements()->where('is_deleted', false)->orderBy('seq')->get())
                ->map(fn (WhiteboardElement $element): array => $element->data)
                ->all(),
            'seq' => $board->seq,
            'links' => [
                'team' => $isGuest ? null : route('teams.show', [$board->team->workspace, $board->team], absolute: false),
                'sessions' => $isGuest ? null : route('teams.sessions.index', [$board->team->workspace, $board->team, 'kind' => 'whiteboard'], absolute: false),
            ],
            'emojiData' => EmojiData::location(),
            'viewerIsObserver' => $viewer->user?->isObserverOf($board->team) ?? false,
            'serverTime' => now()->utc()->format('Y-m-d\TH:i:s.v\Z'),
        ];
    }

    /**
     * A board outlives its sessions: a countdown nobody stopped must not
     * read "Time's up!" for ever (spec §11.1).
     */
    private function timerEndsAt(Whiteboard $board): ?string
    {
        $endsAt = $board->timer_ends_at;

        if ($endsAt === null || $endsAt->lt(now()->subMinutes(self::TimerLingerMinutes))) {
            return null;
        }

        return $endsAt->toIso8601String();
    }
}
